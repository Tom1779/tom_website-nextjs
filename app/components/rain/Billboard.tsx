"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { AWNING_ZONE, BILLBOARD_LAMP, BILLBOARD_PAD } from "./layout";
import { pxToWorld, worldPerPixel } from "./quality";

const AWN_OVER = 6; // px the rail sticks out past each side of the sign
const AWN_FLARE = 14; // px the canvas flares out past the rail at its hem
const AWN_FACE = 30; // px height of the canvas face when fully out
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
  uniform vec2 uSize;    // plane size px
  uniform vec4 uAwn;     // centre x, rail y, rail half-width, full face height (local px)
  uniform float uFlare;  // how far the canvas flares past the rail at each side when fully out
  uniform vec4 uBand;    // marquee band at the top of the sign: x, y, w, h (local px)
  uniform float uBottom; // where the streams land (local px)
  uniform float uExt;
  uniform float uTime;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  const float STRIPES = 22.0;
  const vec3 RED = vec3(0.62, 0.07, 0.09);
  const vec3 CREAM = vec3(0.9, 0.88, 0.84);

  // half-width of the canvas at v (0 at the rail .. 1 at the bottom edge): rounded shoulders
  float halfW(float v, float ext) {
    return uAwn.z + uFlare * ext * pow(sin(clamp(v, 0.0, 1.0) * 1.5708), 0.55);
  }

  vec4 over(vec4 dst, vec3 c, float a) { return vec4(mix(dst.rgb, c, a), a + dst.a * (1.0 - a)); }

  void main() {
    vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    float ext = clamp(uExt, 0.0, 1.15);
    vec4 outCol = vec4(0.0);

    // marquee bulbs chasing along the top of the sign (the awning folds out over them)
    vec2 bq = p - uBand.xy;
    if (bq.x > -6.0 && bq.x < uBand.z + 6.0 && bq.y > -6.0 && bq.y < uBand.w + 6.0) {
      float spacing = 14.0;
      float n = max(1.0, floor(uBand.z / spacing));
      float gap = uBand.z / n;
      float i = floor(bq.x / gap);
      vec2 c = vec2((i + 0.5) * gap, uBand.w * 0.5);
      float d = length(bq - c);
      float on = step(fract((i - uTime * 7.0) / 3.0), 0.34);
      float lit = mix(0.35, 1.0, on);
      float bulb = 1.0 - smoothstep(2.2, 3.2, d);
      vec3 bc = vec3(1.0, 0.82, 0.5) * lit;
      bc += vec3(1.0, 0.95, 0.85) * (1.0 - smoothstep(0.0, 1.4, d)) * on * 0.6; // hot centre
      outCol = over(outCol, bc, bulb);
      float glow = exp(-d / 4.0) * 0.55 * on * (1.0 - bulb);
      outCol = over(outCol, vec3(1.0, 0.75, 0.4), glow);
    }

    float cx = uAwn.x;
    float railY = uAwn.y;
    float faceH = uAwn.w * ext;
    float valH = 9.0 * min(ext, 1.0);
    float dx = p.x - cx;

    if (ext > 0.02) {
      // soft shadow the awning casts on the sign below it
      float botY = railY + faceH + valH;
      float hwB = halfW(1.0, ext);
      float sh = step(botY - 2.0, p.y) * (1.0 - smoothstep(0.0, 22.0, p.y - botY)) * (1.0 - smoothstep(hwB - 6.0, hwB + 4.0, abs(dx)));
      outCol = vec4(0.0, 0.0, 0.0, sh * 0.45 * min(ext, 1.0));

      // the canvas face
      float v = (p.y - railY) / max(faceH, 1.0);
      if (v >= 0.0 && v <= 1.0) {
        float hw = halfW(v, ext);
        float u = dx / hw; // -1..1 across the canvas, so the stripes fan out with the flare
        if (abs(u) <= 1.0) {
          float sCoord = (u * 0.5 + 0.5) * STRIPES;
          float stripe = step(0.5, fract(sCoord));
          vec3 c = mix(RED, CREAM, stripe);
          // rounded: a highlight across the upper belly, darker at the shoulders and the hem
          float light = 0.62 + 0.42 * exp(-pow((v - 0.3) / 0.28, 2.0)) - 0.18 * v;
          light *= 1.0 - 0.3 * pow(abs(u), 6.0);
          c *= light;
          // soft seam between stripes
          c *= 0.9 + 0.1 * smoothstep(0.0, 0.08, min(fract(sCoord), 1.0 - fract(sCoord)));
          // wet sheen and the warm lamp light from the sign below
          c += vec3(1.0) * 0.07 * exp(-pow((v - 0.22) / 0.06, 2.0));
          c += vec3(1.0, 0.8, 0.5) * 0.12 * v * v;
          float aa = 1.0 - smoothstep(hw - 1.0, hw + 0.5, abs(dx));
          outCol = over(outCol, c, aa);
        }
      }

      // scalloped valance: one scallop per stripe, following the flare
      if (p.y > railY + faceH - 1.0 && p.y < railY + faceH + valH) {
        float hw = halfW(1.0, ext);
        float u = dx / hw;
        if (abs(u) <= 1.0) {
          float sCoord = (u * 0.5 + 0.5) * STRIPES;
          float f = fract(sCoord) - 0.5;
          float edge = railY + faceH + valH * (0.35 + 0.65 * sqrt(max(0.0, 1.0 - f * f * 4.0)));
          if (p.y < edge) {
            float stripe = step(0.5, fract(sCoord));
            vec3 c = mix(RED, CREAM, stripe) * (0.62 - 0.18 * (p.y - railY - faceH) / max(valH, 1.0));
            c += vec3(1.0, 0.8, 0.5) * 0.14;
            outCol = over(outCol, c, 1.0 - smoothstep(edge - 1.0, edge, p.y));
          }
        }
      }

      // the rail it rolls out from, with small end brackets
      float railHW = uAwn.z + 3.0;
      float rail = step(abs(dx), railHW) * step(railY - 3.0, p.y) * step(p.y, railY + 1.0);
      float caps = step(railHW - 3.0, abs(dx)) * step(abs(dx), railHW) * step(railY - 5.0, p.y) * step(p.y, railY + 3.0);
      outCol = over(outCol, vec3(0.18, 0.19, 0.22) * (1.0 + 0.6 * step(p.y, railY - 2.0)), clamp(rail + caps, 0.0, 1.0));
    }

    // the water it catches pours off its two lower corners in thin wobbly streams, landing with a splash
    float flow = smoothstep(0.35, 1.0, ext);
    float hwB = halfW(1.0, ext);
    for (int s = 0; s < 2; s++) {
      float sx = cx + (s == 0 ? -1.0 : 1.0) * (hwB - 2.0);
      float top = railY + faceH + valH * 0.5;
      if (p.y > top && p.y < uBottom) {
        float wob = sin(p.y * 0.12 + uTime * 9.0 + float(s) * 2.0) * 0.8;
        float core = 1.0 - smoothstep(0.5, 1.4, abs(p.x - sx - wob));
        float seg = fract((p.y - uTime * 520.0) / 22.0 + float(s) * 0.37);
        float dash = smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.55, 0.75, seg));
        float near = exp(-(p.y - top) / 60.0);
        float a = core * mix(dash, 1.0, near * 0.7) * 0.7 * flow;
        outCol = over(outCol, vec3(0.72, 0.82, 0.96), a);
      }
      vec2 q = p - vec2(sx, uBottom);
      float burst = 0.0;
      for (int k = 0; k < 4; k++) {
        float hk = hash(vec2(float(k), float(s)));
        float ph = fract(uTime * 3.0 + hk);
        vec2 dp = vec2((float(k) - 1.5) * (2.0 + 4.0 * ph), -sin(ph * 3.14159) * (5.0 + 5.0 * hk));
        burst = max(burst, (1.0 - smoothstep(0.6, 1.4, length(q - dp))) * (1.0 - ph));
      }
      float ring = exp(-abs(length(q * vec2(1.0, 3.0)) - fract(uTime * 2.2) * 10.0) * 1.5) * (1.0 - fract(uTime * 2.2));
      outCol = over(outCol, vec3(0.72, 0.82, 0.96), clamp(burst + ring * 0.6, 0.0, 1.0) * flow);
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
      uFlare: { value: 0 },
      uBand: { value: new THREE.Vector4() },
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
    // the rail sits in the gap between the windows above and the sign, never over the windows
    const clearance = L.gap.y * 0.65; // window bottom -> sign top
    const railY = sy - Math.max(4, Math.min(24, clearance - 4));
    const cxA = sx + b.w / 2;
    const railHW = b.w / 2 + AWN_OVER;
    const hem = railHW + AWN_FLARE * Math.min(1, e.x);
    rainStore.awning.x0 = cxA - hem;
    rainStore.awning.x1 = cxA + hem;
    // never hang lower than the empty band at the top of the sign (keeps the title and page clear)
    const face = Math.max(6, Math.min(AWN_FACE, sy + AWNING_ZONE - 2 - railY - 9));
    rainStore.awning.yFront = railY + (face + 9) * Math.min(1, e.x);
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
    const px0 = cxA - railHW - AWN_FLARE * 1.2 - AWN_MARGIN;
    const py0 = railY - 8;
    const pw = (railHW + AWN_FLARE * 1.2 + AWN_MARGIN) * 2;
    const ph = sy + b.h + AWN_MARGIN - py0;
    const [acx, acy] = pxToWorld(px0 + pw / 2, py0 + ph / 2, size.width, size.height, 0);
    am.position.set(acx, acy, 0.02);
    am.scale.set(pw * k, ph * k, 1);
    au.uSize.value.set(pw, ph);
    au.uAwn.value.set(cxA - px0, railY - py0, railHW, face);
    au.uFlare.value = AWN_FLARE;
    au.uBand.value.set(sx + 3 - px0, sy + 3 - py0, b.w - 6, AWNING_ZONE);
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
