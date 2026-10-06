"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { worldPerPixel } from "./quality";

const SIGNAL_Z = -29;
export const ROOF_H = 90; // px of rooftop at the bottom of the signal section

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Under the project city: low rain clouds, a rooftop searchlight, and its beam projecting a disc of
// light onto the clouds where the profile card sits. Screen px + document y throughout.
const fragmentShader = /* glsl */ `
  uniform vec2 uView;     // viewport px
  uniform float uScroll;  // window.scrollY
  uniform vec2 uSec;      // section top / bottom (document y)
  uniform vec4 uCard;     // card centre x, y (document) and half size
  uniform vec2 uLight;    // searchlight lens (document)
  uniform float uTime;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  const vec3 BEAM = vec3(1.0, 0.9, 0.62);

  void main() {
    vec2 sp = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
    vec2 p = vec2(sp.x, sp.y + uScroll);
    if (p.y < uSec.x - 220.0 || p.y > uSec.y + 4.0) { gl_FragColor = vec4(0.0); return; }

    // low, slow-moving rain clouds
    float clouds = fbm(p * vec2(0.0028, 0.0055) + vec2(uTime * 0.012, 0.0));
    float detail = fbm(p * 0.012 + vec2(-uTime * 0.02, uTime * 0.01));
    vec3 col = mix(vec3(0.03, 0.038, 0.058), vec3(0.085, 0.1, 0.135), smoothstep(0.35, 0.75, clouds));
    col += vec3(0.03, 0.035, 0.045) * smoothstep(0.55, 0.8, detail);

    // the projected disc of light on the clouds, lumpy where the cloud is thicker
    vec2 c = uCard.xy;
    vec2 rad = vec2(max(uCard.z, uCard.w) * mix(1.06, 1.25, step(700.0, uView.x)));
    float r = length((p - c) / rad);
    float lump = 0.55 + 0.9 * smoothstep(0.3, 0.8, clouds) * (0.7 + 0.3 * detail);
    float disc = (1.0 - smoothstep(0.82, 1.0, r)) * lump;
    float rim = exp(-abs(r - 0.92) * 18.0) * 0.6;
    col += BEAM * (disc * 0.32 + rim * 0.35) * (0.94 + 0.06 * sin(uTime * 13.0) * sin(uTime * 7.3));

    // the beam: a widening cone from the lens to the disc, with dust and lit rain inside it
    vec2 L = uLight;
    vec2 D = c - L;
    float len = length(D);
    vec2 dir = D / len;
    float t = dot(p - L, dir) / len;
    float perp = abs(dot(p - L, vec2(-dir.y, dir.x)));
    float halfW = mix(12.0, rad.x * 0.9, clamp(t, 0.0, 1.0));
    float inBeam = (1.0 - smoothstep(halfW * 0.65, halfW, perp)) * step(0.0, t) * (1.0 - smoothstep(0.9, 1.0, t));
    float dust = 0.75 + 0.5 * fbm(vec2(perp * 0.02, t * 6.0 - uTime * 0.3));
    float cx = floor(p.x / 3.0);
    float drops = step(0.95, hash(vec2(cx, floor((p.y + uTime * 950.0 + hash(vec2(cx, 1.0)) * 300.0) / 24.0))));
    float halo = (1.0 - smoothstep(halfW, halfW * 1.8, perp)) * step(0.0, t) * (1.0 - smoothstep(0.85, 1.0, t));
    col += BEAM * inBeam * (0.24 * dust * (1.0 - 0.45 * t) + drops * 0.4) + BEAM * halo * 0.05;

    // rooftop along the bottom of the section
    float roofTop = uSec.y - ${ROOF_H.toFixed(1)};
    if (p.y > roofTop) {
      float ry = p.y - roofTop;
      vec3 roof = vec3(0.04, 0.045, 0.06) * (0.8 + 0.4 * vnoise(p * 0.05));
      roof = mix(roof, vec3(0.12, 0.13, 0.16), 1.0 - smoothstep(0.0, 3.0, ry)); // parapet edge
      roof += BEAM * 0.12 * exp(-length((p - vec2(L.x, roofTop)) / vec2(160.0, 30.0)));
      col = roof;
    }
    // vents and a water tank on the roof
    float tx = uView.x * 0.8;
    float tank = step(abs(p.x - tx), 30.0) * step(roofTop - 56.0, p.y) * step(p.y, roofTop);
    float vent = step(abs(p.x - uView.x * 0.18), 10.0) * step(roofTop - 18.0, p.y) * step(p.y, roofTop);
    col = mix(col, vec3(0.05, 0.055, 0.07), max(tank, vent));

    // the searchlight: stand, drum aimed along the beam, bright lens
    vec2 q = p - L;
    float stand = step(abs(q.x), 6.0) * step(18.0, q.y) * step(q.y, roofTop - L.y);
    float base = step(abs(q.x), 26.0) * step(roofTop - L.y - 8.0, q.y) * step(q.y, roofTop - L.y);
    vec2 qd = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float drum = step(-42.0, qd.x) * step(qd.x, 0.0) * step(abs(qd.y), 22.0);
    col = mix(col, vec3(0.1, 0.105, 0.12), clamp(stand + base + drum, 0.0, 1.0));
    float lens = 1.0 - smoothstep(18.0, 21.0, length(vec2(qd.x * 2.4, qd.y)));
    col = mix(col, BEAM * 1.3, lens);
    col += BEAM * exp(-length(q) / 40.0) * 0.6;

    col += vec3(0.3, 0.33, 0.45) * uFlash * 0.3;
    float alpha = smoothstep(uSec.x - 220.0, uSec.x + 60.0, p.y);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Signal() {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uView: { value: new THREE.Vector2(1, 1) },
      uScroll: { value: 0 },
      uSec: { value: new THREE.Vector2(0, 0) },
      uCard: { value: new THREE.Vector4() },
      uLight: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    const u = matRef.current?.uniforms;
    const sec = rainStore.signalEl;
    const card = rainStore.signalCardEl;
    if (!m || !u || !sec || !card) {
      if (m) m.visible = false;
      return;
    }
    const sy = window.scrollY;
    const sr = sec.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const top = sr.top + sy;
    const bottom = sr.bottom + sy;
    // the pool and waterfalls start where the rooftop ends
    rainStore.streetTop = bottom;

    const visible = sr.top - 220 < size.height && sr.bottom > 0;
    m.visible = visible;
    if (!visible) return;

    const k = worldPerPixel(size.height, SIGNAL_Z);
    m.position.set(0, 0, SIGNAL_Z);
    m.scale.set(size.width * k * 1.01, size.height * k * 1.01, 1);

    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2 + sy;
    // searchlight sits on the roof, off to one side so the beam slants up to the card
    const lx = size.width < 768 ? cx + size.width * 0.18 : cx - Math.min(260, size.width * 0.18);
    u.uView.value.set(size.width, size.height);
    u.uScroll.value = sy;
    u.uSec.value.set(top, bottom);
    u.uCard.value.set(cx, cy, cr.width / 2, cr.height / 2);
    u.uLight.value.set(lx, bottom - ROOF_H - 34);
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = rainStore.flash;
  });

  return (
    <mesh ref={mesh} renderOrder={-5} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
