"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore, MAX_RIPPLES } from "./store";
import { worldPerPixel } from "./quality";

const STREET_Z = -30;
const LAMP_PERIOD = 780; // px of scroll between lamps on the same side

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A wet street at night under the city: asphalt and puddles reflecting the city lights, rain rings,
// street lamps down both sides, and ripples that follow the cursor. Works in screen px + document y.
const fragmentShader = /* glsl */ `
  #define MAXR ${MAX_RIPPLES}
  uniform vec2 uView;       // viewport px
  uniform float uScroll;    // window.scrollY
  uniform float uTop;       // document y where the street starts
  uniform float uTime;
  uniform float uNow;       // seconds, same clock as the ripple timestamps
  uniform float uFlash;
  uniform vec3 uRip[MAXR];  // cursor ripples: x, document y, start time
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  const vec3 WARM = vec3(1.0, 0.72, 0.4);

  // One street lamp whose head is at (lx, hy); the arm reaches toward the middle of the street
  vec3 lamp(vec2 p, float lx, float hy, float side, out float a) {
    vec3 col = vec3(0.0);
    a = 0.0;
    float postH = 330.0;
    float headX = lx + side * 48.0;
    vec2 bulb = vec2(headX, hy + 9.0);
    // post (lit on the side facing the bulb), base plinth, arm and head housing
    float post = step(abs(p.x - lx), 3.0) * step(hy, p.y) * step(p.y, hy + postH);
    float lit = step(0.0, (p.x - lx) * side);
    float plinth = step(abs(p.x - lx), 6.0) * step(hy + postH - 18.0, p.y) * step(p.y, hy + postH);
    float arm = step(abs(p.y - hy - 2.0), 1.8) * step(min(lx, headX), p.x) * step(p.x, max(lx, headX));
    float housing = step(abs(p.x - headX), 11.0 - (p.y - hy) * 0.6) * step(hy - 2.0, p.y) * step(p.y, hy + 7.0);
    float m = clamp(post + plinth + arm + housing, 0.0, 1.0);
    vec3 metal = vec3(0.09, 0.1, 0.125) + WARM * 0.12 * lit * post;
    col = mix(col, metal, m);
    a = max(a, m);
    // the bulb and its halo
    float d = length(p - bulb);
    float glow = (1.0 - smoothstep(4.0, 6.0, d)) * 1.2 + exp(-d / 22.0) * 0.6 + exp(-d / 70.0) * 0.18;
    col += WARM * glow;
    a = max(a, min(1.0, glow));
    // cone of light to the pavement, rain drops lit up inside it
    float dy = p.y - bulb.y;
    float halfW = dy * 0.36 + 4.0;
    float cone = step(0.0, dy) * step(dy, postH - 6.0) * (1.0 - smoothstep(halfW * 0.7, halfW, abs(p.x - headX)));
    float fall = 1.0 - 0.7 * dy / postH;
    float cx = floor(p.x / 3.0);
    float drops = step(0.955, hash(vec2(cx, floor((p.y + uTime * 950.0 + hash(vec2(cx, 1.0)) * 300.0) / 24.0))));
    float coneL = cone * fall * (0.1 + drops * 0.55);
    col += WARM * coneL;
    a = max(a, coneL);
    // pool of light on the wet ground, and its reflection smeared down the street
    vec2 pool = (p - vec2(headX, hy + postH)) / vec2(120.0, 26.0);
    float pl = exp(-dot(pool, pool) * 2.0) * 0.5;
    float below = p.y - (hy + postH);
    float wob = sin(p.y * 0.05 + uTime * 1.5) * 3.0;
    float smear = step(0.0, below) * exp(-below / 160.0) * exp(-abs(p.x + wob - headX) / 10.0)
                * (0.5 + 0.5 * vnoise(vec2(p.x * 0.1, p.y * 0.03 - uTime * 0.4))) * 0.45;
    col += WARM * (pl + smear);
    a = max(a, pl + smear);
    return col;
  }

  void main() {
    vec2 sp = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
    vec2 p = vec2(sp.x, sp.y + uScroll); // document space
    float depth = p.y - uTop;
    if (depth < -60.0) { gl_FragColor = vec4(0.0); return; }

    // wet asphalt, with puddles where it's darker and more mirror-like
    vec3 col = vec3(0.026, 0.031, 0.044) * mix(0.8, 1.15, vnoise(p * 0.05));
    float puddle = smoothstep(0.52, 0.6, fbm(p * vec2(0.004, 0.009) + 3.0));
    col *= 1.0 - puddle * 0.35;

    // the city's lights smeared down the wet street (strongest just under the buildings)
    float col34 = floor(p.x / 34.0);
    float h = hash(vec2(col34, 5.0));
    vec3 lightCol = h > 0.82 ? vec3(0.25, 0.4, 0.9) : WARM;
    float on = step(0.45, h);
    float wob = sin(p.y * 0.035 + uTime * 1.3 + col34) * (2.0 + puddle * 4.0);
    float streak = fbm(vec2((p.x + wob) * 0.06, p.y * 0.004 - uTime * 0.08));
    float refl = on * smoothstep(0.45, 0.85, streak) * exp(-max(depth, 0.0) / 420.0);
    col += lightCol * refl * (0.18 + puddle * 0.35);

    // rain landing: little rings everywhere, brighter in the puddles
    vec2 rc = floor(p / 70.0);
    vec2 rf = p - rc * 70.0 - 35.0;
    float rh = hash(rc + floor(uTime * 0.9 + hash(rc) * 4.0));
    vec2 rpos = (vec2(hash(rc + 1.7), hash(rc + 3.1)) - 0.5) * 40.0;
    float age = fract(uTime * 0.9 + hash(rc) * 4.0);
    float rr = age * 22.0;
    float ring = exp(-abs(length((rf - rpos) * vec2(1.0, 2.4)) - rr) * 1.2) * (1.0 - age) * step(0.35, rh);
    col += vec3(0.45, 0.55, 0.75) * ring * (0.08 + puddle * 0.18);

    // ripples spreading from the cursor
    for (int i = 0; i < MAXR; i++) {
      vec3 r = uRip[i];
      float t = uNow - r.z;
      if (t < 0.0 || t > 1.8) continue;
      float dist = length((p - r.xy) * vec2(1.0, 2.2));
      float rad = t * 80.0;
      float w = exp(-abs(dist - rad) / 2.2) + exp(-abs(dist - rad * 0.6) / 2.0) * 0.5;
      col += vec3(0.6, 0.75, 1.0) * w * (1.0 - t / 1.8) * 0.2;
    }

    // street lamps down both sides, staggered
    float wide = step(900.0, uView.x);
    float lxL = mix(uView.x * 0.03, uView.x * 0.06, wide);
    float lxR = uView.x - lxL;
    // each lamp owns the stretch from 200px above its head, so its glow fades out before the next region
    float local = depth - 140.0 + 200.0;
    float kL = floor(local / ${LAMP_PERIOD.toFixed(1)});
    float kR = floor((local - ${(LAMP_PERIOD / 2).toFixed(1)}) / ${LAMP_PERIOD.toFixed(1)});
    float la;
    vec3 lc = vec3(0.0);
    if (kL >= 0.0) {
      lc += lamp(p, lxL, uTop + 140.0 + kL * ${LAMP_PERIOD.toFixed(1)}, 1.0, la);
      col = mix(col, lc, step(0.99, la));
      col += lc * (1.0 - step(0.99, la));
    }
    lc = vec3(0.0);
    if (kR >= 0.0) {
      lc += lamp(p, lxR, uTop + 140.0 + ${(LAMP_PERIOD / 2).toFixed(1)} + kR * ${LAMP_PERIOD.toFixed(1)}, -1.0, la);
      col = mix(col, lc, step(0.99, la));
      col += lc * (1.0 - step(0.99, la));
    }

    // lightning, and a soft vignette toward the screen edges
    col += vec3(0.3, 0.33, 0.45) * uFlash * 0.35;
    col *= 1.0 - 0.35 * pow(abs(vUv.x - 0.5) * 2.0, 3.0);

    float alpha = smoothstep(-60.0, 90.0, depth);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Street() {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uView: { value: new THREE.Vector2(1, 1) },
      uScroll: { value: 0 },
      uTop: { value: 0 },
      uTime: { value: 0 },
      uNow: { value: 0 },
      uFlash: { value: 0 },
      uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3(0, 0, -100)) },
    }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    const u = matRef.current?.uniforms;
    if (!m || !u) return;
    const top = rainStore.streetTop;
    // nothing to draw until the street has scrolled near the screen
    const visible = Number.isFinite(top) && top - window.scrollY < size.height + 60;
    m.visible = visible;
    if (!visible) return;

    const k = worldPerPixel(size.height, STREET_Z);
    m.position.set(0, 0, STREET_Z);
    m.scale.set(size.width * k * 1.01, size.height * k * 1.01, 1);

    u.uView.value.set(size.width, size.height);
    u.uScroll.value = window.scrollY;
    u.uTop.value = top;
    u.uTime.value = state.clock.elapsedTime;
    u.uNow.value = performance.now() / 1000;
    u.uFlash.value = rainStore.flash;
    rainStore.ripples.forEach((r, i) => u.uRip.value[i].set(r.x, r.y, r.t));
  });

  return (
    <mesh ref={mesh} renderOrder={-6} frustumCulled={false}>
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
