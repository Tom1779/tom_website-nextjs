"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { worldPerPixel } from "./quality";

const SIGNAL_Z = -29;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A searchlight on a rooftop of the project city, its beam lighting up the rain and landing as a disc
// of light on the low clouds where the profile card hangs in the sky. Screen px throughout.
const fragmentShader = /* glsl */ `
  uniform vec2 uView;   // viewport px
  uniform vec4 uCard;   // card centre (screen px) and half size
  uniform vec2 uLight;  // searchlight lens (screen px)
  uniform float uRoof;  // roof line under the searchlight (screen px)
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
    vec2 p = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
    vec2 c = uCard.xy;
    float R = max(uCard.z, uCard.w) * 1.2;

    // light is accumulated, then the searchlight hardware is drawn over it
    float light = 0.0;

    // drifting low clouds, only visible where the light catches them
    float clouds = fbm(p * vec2(0.004, 0.008) + vec2(uTime * 0.015, 0.0));
    float detail = fbm(p * 0.015 + vec2(-uTime * 0.02, uTime * 0.01));
    float r = length(p - c) / R;
    float lump = 0.45 + 0.9 * smoothstep(0.3, 0.8, clouds) * (0.7 + 0.3 * detail);
    light += (1.0 - smoothstep(0.8, 1.0, r)) * lump * 0.34;
    light += exp(-abs(r - 0.92) * 16.0) * 0.4;                    // brighter rim of the disc
    light += exp(-max(r - 1.0, 0.0) * 3.0) * step(1.0, r) * 0.06;  // soft spill around it

    // the beam: a widening cone from the lens to the disc, with dust and lit rain inside it
    vec2 D = c - uLight;
    float len = max(length(D), 1.0);
    vec2 dir = D / len;
    float t = dot(p - uLight, dir) / len;
    float perp = abs(dot(p - uLight, vec2(-dir.y, dir.x)));
    float halfW = mix(10.0, R * 0.85, clamp(t, 0.0, 1.0));
    float span = step(0.0, t) * (1.0 - smoothstep(0.88, 1.0, t));
    float inBeam = (1.0 - smoothstep(halfW * 0.6, halfW, perp)) * span;
    float haze = (1.0 - smoothstep(halfW, halfW * 1.9, perp)) * span;
    float dust = 0.75 + 0.5 * fbm(vec2(perp * 0.02, t * 6.0 - uTime * 0.3));
    float cx = floor(p.x / 3.0);
    float drops = step(0.95, hash(vec2(cx, floor((p.y + uTime * 950.0 + hash(vec2(cx, 1.0)) * 300.0) / 24.0))));
    light += inBeam * (0.22 * dust * (1.0 - 0.45 * t) + drops * 0.45) + haze * 0.05;

    light *= 0.94 + 0.06 * sin(uTime * 13.0) * sin(uTime * 7.3);
    light *= 1.0 - uFlash * 0.6; // lightning washes the signal out
    light = clamp(light, 0.0, 1.0);
    vec4 outCol = vec4(BEAM, light);

    // the searchlight on the roof: base, yoke and a drum aimed along the beam, bright lens
    vec2 q = p - uLight;
    vec2 qd = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float drum = step(-34.0, qd.x) * step(qd.x, 0.0) * step(abs(qd.y), 17.0);
    float yoke = step(abs(q.x), 4.0) * step(0.0, q.y) * step(p.y, uRoof);
    float base = step(abs(q.x), 18.0) * step(uRoof - 7.0, p.y) * step(p.y, uRoof);
    float body = clamp(drum + yoke + base, 0.0, 1.0);
    vec3 metal = vec3(0.1, 0.105, 0.125) + BEAM * 0.12 * step(0.0, -qd.y) * drum;
    outCol = mix(outCol, vec4(metal, 1.0), body);
    float lens = 1.0 - smoothstep(14.0, 16.5, length(vec2(qd.x * 2.4, qd.y)));
    outCol = mix(outCol, vec4(BEAM * 1.25, 1.0), lens);
    float glow = exp(-length(q) / 32.0) * 0.7;
    outCol.rgb = mix(outCol.rgb, BEAM, glow * (1.0 - outCol.a));
    outCol.a = max(outCol.a, glow);

    gl_FragColor = outCol;
  }
`;

export default function Signal() {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uView: { value: new THREE.Vector2(1, 1) },
      uCard: { value: new THREE.Vector4() },
      uLight: { value: new THREE.Vector2() },
      uRoof: { value: 0 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    const u = matRef.current?.uniforms;
    const card = rainStore.signalCardEl;
    const L = rainStore.layout;
    const city = rainStore.cityEl;
    if (!m || !u || !card || !L || !city) {
      if (m) m.visible = false;
      return;
    }
    const cr = card.getBoundingClientRect();
    const cityR = city.getBoundingClientRect();
    const visible = cr.bottom + 400 > 0 && cr.top < size.height;
    m.visible = visible;
    if (!visible) return;

    const k = worldPerPixel(size.height, SIGNAL_Z);
    m.position.set(0, 0, SIGNAL_Z);
    m.scale.set(size.width * k * 1.01, size.height * k * 1.01, 1);

    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    // mount the searchlight on a roof some way across from the card, so the beam sweeps diagonally
    const reach = size.width * (size.width < 768 ? 0.22 : 0.32);
    let best = L.buildings[0];
    let bestD = Infinity;
    for (const b of L.buildings) {
      const d = Math.abs(Math.abs(cityR.left + b.x + b.w / 2 - cx) - reach) + b.depth * 200;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    const roof = cityR.top + best.top;
    const bLeft = cityR.left + best.x;
    // sit on the side of that roof facing the card
    const toward = cx > bLeft + best.w / 2 ? 1 : -1;
    const lx = bLeft + best.w / 2 + toward * best.w * 0.3;

    u.uView.value.set(size.width, size.height);
    u.uCard.value.set(cx, cy, cr.width / 2, cr.height / 2);
    u.uLight.value.set(lx, roof - 26);
    u.uRoof.value = roof;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = rainStore.flash;
  });

  return (
    // after the buildings (0), so the mid-ground row doesn't hide the lamp; before the pixel clouds (1)
    <mesh ref={mesh} renderOrder={0.5} frustumCulled={false}>
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
