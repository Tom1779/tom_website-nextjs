"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { worldPerPixel } from "./quality";

const CITY_Z = -40;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Two procedural skyline layers with lit windows, sky gradient and rain haze.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform float uScroll;
  uniform float uAspect;
  uniform float uHorizon; // plane-uv height of the apartment roofline
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  // Returns building mask (x) and window light (y) for one skyline layer
  vec2 skyline(vec2 uv, float density, float baseH, float varH, float seed) {
    float x = uv.x * density;
    float id = floor(x);
    float h = baseH + hash(id + seed) * varH;
    // occasional tall towers
    h += step(0.86, hash(id * 3.1 + seed)) * varH * 0.9;
    // only above the roofline: below it is the apartment block (or, once it scrolls away, open haze)
    float inside = step(uv.y, h) * step(0.0, uv.y);
    // windows
    vec2 w = vec2(fract(x) * 6.0, uv.y * density * 9.0);
    vec2 wid = floor(w);
    vec2 wf = fract(w);
    float frame = step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.8);
    float lit = step(0.72, hash2(wid + id * 17.0 + seed));
    // a few windows flicker
    float flick = 0.75 + 0.25 * sin(uTime * (0.5 + hash2(wid + id) * 2.0) + id);
    float edge = step(0.08, fract(x)) * step(fract(x), 0.92);
    return vec2(inside, inside * frame * lit * edge * flick * step(uv.y, h - 0.012));
  }

  void main() {
    vec2 uv = vUv;
    uv.x *= uAspect;

    // sky
    vec3 top = vec3(0.012, 0.02, 0.05);
    vec3 horizon = vec3(0.05, 0.075, 0.13);
    vec3 col = mix(horizon, top, smoothstep(0.1, 0.95, vUv.y));
    // the distant skyline peeks over the apartment roof, so measure heights from the roofline
    float hy = vUv.y - uHorizon;
    vec2 suv = vec2(uv.x, hy / 0.55);

    // city glow near the horizon
    col += vec3(0.09, 0.06, 0.08) * smoothstep(0.35, 0.0, hy) * 0.6;

    // far layer
    vec2 far = skyline(suv + vec2(0.0, uScroll * 0.01), 14.0, 0.22, 0.2, 3.0);
    col = mix(col, vec3(0.03, 0.045, 0.075), far.x * 0.9);
    col += vec3(0.55, 0.42, 0.25) * far.y * 0.25;

    // near layer
    vec2 nearL = skyline(suv + vec2(0.37, uScroll * 0.02), 7.0, 0.1, 0.18, 11.0);
    col = mix(col, vec3(0.012, 0.018, 0.03), nearL.x);
    col += vec3(0.9, 0.7, 0.45) * nearL.y * 0.35;

    // rain haze
    col = mix(col, vec3(0.07, 0.09, 0.13), 0.22 * smoothstep(0.45, 0.0, hy));

    // lightning lights the sky from above
    col += vec3(0.55, 0.6, 0.85) * uFlash * (0.25 + 0.75 * vUv.y) * (1.0 - nearL.x * 0.85);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function City() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uScroll: { value: 0 },
      uAspect: { value: 1 },
      uHorizon: { value: 0 },
    }),
    [],
  );

  // Scale the plane to always cover the viewport at its depth
  const k = worldPerPixel(size.height, CITY_Z);
  const w = size.width * k * 1.05;
  const h = size.height * k * 1.05;

  // R3F copies uniform values into the material, so update them through the material itself
  useFrame((state) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uAspect.value = w / h;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = rainStore.flash;
    u.uScroll.value = window.scrollY / Math.max(1, size.height);
    // roofline in screen px -> uv on this (slightly oversized) plane; without a building, use the bottom
    const roof = rainStore.roofY;
    const target = Number.isFinite(roof) ? 0.5 + (0.5 - roof / size.height) / 1.05 : 0;
    u.uHorizon.value = target;
  });

  return (
    <mesh position={[0, 0, CITY_Z]} scale={[w, h, 1]} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}
