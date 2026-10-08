"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { BILLBOARD_LAMP, BILLBOARD_PAD } from "./layout";
import { pxToWorld, worldPerPixel } from "./quality";

const AWN_OVER = 10; // px the awning sticks out past each side of the sign
const AWN_UP = BILLBOARD_LAMP + 10; // attaches to the wall this far above the sign (over the lamps)
const AWN_DEPTH = 26; // px the sloping awning covers when fully out
const AWN_MARGIN = 40; // extra plane around the awning for the streams and splashes

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A striped awning that unfolds over the billboard, and the rain it catches running off both ends in
// thin streams down the sides of the sign. Local px: (0,0) is the plane's top-left.
const awningFragment = /* glsl */ `
  uniform vec2 uSize;   // plane size px
  uniform vec4 uAwn;    // awning left x, attach y, width, full depth (local px)
  uniform float uBottom; // where the streams land (local px)
  uniform float uExt;
  uniform float uTime;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    float ext = clamp(uExt, 0.0, 1.2);
    vec4 outCol = vec4(0.0);

    float x0 = uAwn.x;
    float x1 = uAwn.x + uAwn.z;
    float yA = uAwn.y;
    float d = uAwn.w * ext;              // how far it has unfolded (seen from the front, it hangs lower)
    float yF = yA + d;                   // front edge
    float lx = p.x - x0;

    // canvas: vertical stripes, darker up at the wall, wet sheen
    if (ext > 0.02 && p.x >= x0 && p.x <= x1 && p.y >= yA && p.y <= yF) {
      float t = (p.y - yA) / max(d, 1.0);
      float stripe = step(0.5, fract(lx / 18.0));
      vec3 c = mix(vec3(0.42, 0.07, 0.09), vec3(0.86, 0.8, 0.68), stripe);
      c *= 0.55 + 0.45 * t;
      c += vec3(0.25) * exp(-abs(t - 0.35) * 12.0) * 0.25;
      outCol = vec4(c, 1.0);
    }
    // scalloped valance along the front edge, lit from below by the sign's lamps
    float vh = 9.0 * min(ext, 1.0);
    if (ext > 0.02 && p.x >= x0 && p.x <= x1 && p.y > yF && p.y < yF + vh) {
      float cell = fract(lx / 18.0) - 0.5;
      float edge = yF + vh * (0.55 + 0.45 * sqrt(max(0.0, 1.0 - cell * cell * 4.0)));
      if (p.y < edge) {
        float stripe = step(0.5, fract(lx / 18.0));
        vec3 c = mix(vec3(0.42, 0.07, 0.09), vec3(0.86, 0.8, 0.68), stripe) * 0.9;
        c += vec3(1.0, 0.8, 0.5) * 0.25 * smoothstep(yF, edge, p.y);
        outCol = vec4(c, 1.0);
      }
    }

    // the water it catches pours off both ends in thin wobbly streams, landing with a splash
    float flow = smoothstep(0.35, 1.0, ext);
    for (int s = 0; s < 2; s++) {
      float sx = s == 0 ? x0 + 2.0 : x1 - 2.0;
      float top = yF + vh * 0.6;
      if (p.y > top && p.y < uBottom) {
        float wob = sin(p.y * 0.12 + uTime * 9.0 + float(s) * 2.0) * 0.8;
        float core = 1.0 - smoothstep(0.5, 1.4, abs(p.x - sx - wob));
        // dashes of falling water, denser near the top where it leaves the awning
        float seg = fract((p.y - uTime * 520.0) / 22.0 + float(s) * 0.37);
        float dash = smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.55, 0.75, seg));
        float near = exp(-(p.y - top) / 60.0);
        float a = core * mix(dash, 1.0, near * 0.7) * 0.7 * flow;
        outCol = mix(outCol, vec4(0.72, 0.82, 0.96, 1.0), a * (1.0 - outCol.a));
        outCol.a = max(outCol.a, a);
      }
      // splash where the stream lands
      vec2 q = p - vec2(sx, uBottom);
      float burst = 0.0;
      for (int k = 0; k < 4; k++) {
        float hk = hash(vec2(float(k), float(s)));
        float ph = fract(uTime * 3.0 + hk);
        vec2 dp = vec2((float(k) - 1.5) * (2.0 + 4.0 * ph), -sin(ph * 3.14159) * (5.0 + 5.0 * hk));
        burst = max(burst, (1.0 - smoothstep(0.6, 1.4, length(q - dp))) * (1.0 - ph));
      }
      float ring = exp(-abs(length(q * vec2(1.0, 3.0)) - fract(uTime * 2.2) * 10.0) * 1.5) * (1.0 - fract(uTime * 2.2));
      float sa = clamp(burst + ring * 0.6, 0.0, 1.0) * flow;
      outCol = mix(outCol, vec4(0.72, 0.82, 0.96, 1.0), sa * (1.0 - outCol.a));
      outCol.a = max(outCol.a, sa);
    }

    outCol.rgb += vec3(0.3, 0.33, 0.45) * uFlash * 0.4 * outCol.a;
    gl_FragColor = outCol;
  }
`;

/**
 * Shows the résumé billboard (painted by ResumeBillboard) as a plane in the city, drawn after the buildings
 * and before the rain so the rain falls in front of it. On hover an awning pops out over it: the rain stops
 * falling on the sign and pours off the awning's ends instead.
 */
export default function Billboard() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const awnMesh = useRef<THREE.Mesh>(null);
  const awnMat = useRef<THREE.ShaderMaterial>(null);
  const tex = useRef<{ t: THREE.CanvasTexture; v: number } | null>(null);
  const hover = useRef(0);
  const ext = useRef({ x: 0, v: 0 });
  const size = useThree((s) => s.size);

  const awnUniforms = useMemo(
    () => ({
      uSize: { value: new THREE.Vector2(1, 1) },
      uAwn: { value: new THREE.Vector4() },
      uBottom: { value: 0 },
      uExt: { value: 0 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    }),
    [],
  );

  useEffect(() => () => tex.current?.t.dispose(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const m = mesh.current;
    const mt = mat.current;
    const am = awnMesh.current;
    const au = awnMat.current?.uniforms;
    const L = rainStore.layout;
    const el = rainStore.cityEl;
    const canvas = rainStore.billboardCanvas;
    const b = L?.billboard;
    if (!m || !mt || !am || !au || !L || !el || !canvas || !b) {
      if (m) m.visible = false;
      if (am) am.visible = false;
      rainStore.awning.ext = 0;
      return;
    }
    if (!tex.current || tex.current.v !== rainStore.billboardVersion) {
      tex.current?.t.dispose();
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      tex.current = { t, v: rainStore.billboardVersion };
      mt.map = t;
      mt.needsUpdate = true;
    }

    // the sign plane covers the sign plus the glow margin and the lamps above it
    const r = el.getBoundingClientRect();
    const sx = r.left + b.x;
    const sy = r.top + b.y;
    const x = sx - BILLBOARD_PAD;
    const y = sy - BILLBOARD_PAD - BILLBOARD_LAMP;
    const w = b.w + BILLBOARD_PAD * 2;
    const h = b.h + BILLBOARD_PAD * 2 + BILLBOARD_LAMP;
    const k = worldPerPixel(size.height, 0);
    const visible = y + h > -AWN_MARGIN && y < size.height + AWN_MARGIN;
    m.visible = visible;
    am.visible = visible;

    // the awning springs out on hover (a little overshoot) and folds away after
    const target = rainStore.billboardHover ? 1 : 0;
    const e = ext.current;
    e.v += (140 * (target - e.x) - 15 * e.v) * dt;
    e.x = Math.max(0, e.x + e.v * dt);
    const ax0 = sx - AWN_OVER;
    const ax1 = sx + b.w + AWN_OVER;
    const aTop = sy - AWN_UP;
    rainStore.awning.x0 = ax0;
    rainStore.awning.x1 = ax1;
    rainStore.awning.yFront = aTop + AWN_DEPTH * Math.min(1, e.x);
    rainStore.awning.yBottom = sy + b.h + 6;
    rainStore.awning.ext = e.x;
    if (!visible) return;

    const [cx, cy] = pxToWorld(x + w / 2, y + h / 2, size.width, size.height, 0);
    m.position.set(cx, cy, 0.01);
    m.scale.set(w * k, h * k, 1);

    // brighten a little on hover / focus, and with lightning
    hover.current += (target - hover.current) * Math.min(1, dt * 10);
    const lum = 1 + hover.current * 0.18 + rainStore.flash * 0.3;
    mt.color.setRGB(lum, lum, lum);

    // awning + streams plane: from above the awning down past the bottom of the sign
    const px0 = ax0 - AWN_MARGIN;
    const py0 = aTop - 4;
    const pw = ax1 - ax0 + AWN_MARGIN * 2;
    const ph = sy + b.h + AWN_MARGIN - py0;
    const [acx, acy] = pxToWorld(px0 + pw / 2, py0 + ph / 2, size.width, size.height, 0);
    am.position.set(acx, acy, 0.02);
    am.scale.set(pw * k, ph * k, 1);
    au.uSize.value.set(pw, ph);
    au.uAwn.value.set(AWN_MARGIN, aTop - py0, ax1 - ax0, AWN_DEPTH);
    au.uBottom.value = sy + b.h + 6 - py0;
    au.uExt.value = e.x;
    au.uTime.value = state.clock.elapsedTime;
    au.uFlash.value = rainStore.flash;
  });

  return (
    <>
      <mesh ref={mesh} renderOrder={0.8} frustumCulled={false} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={mat} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={awnMesh} renderOrder={0.85} frustumCulled={false} visible={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={awnMat}
          vertexShader={vertexShader}
          fragmentShader={awningFragment}
          uniforms={awnUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
