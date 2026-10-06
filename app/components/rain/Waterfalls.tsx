"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore, MAX_RIPPLES } from "./store";
import { worldPerPixel } from "./quality";

const WATER_Z = -30;
const POOL_H = 220; // px of pool under the city before it spills over the sides

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Below the city the rain collects in a pool that flows outward and pours over both sides of the
// screen as two waterfalls running down the rest of the page. Screen px + document y throughout.
const fragmentShader = /* glsl */ `
  #define MAXR ${MAX_RIPPLES}
  uniform vec2 uView;       // viewport px
  uniform float uScroll;    // window.scrollY
  uniform float uTop;       // document y where the water starts (under the buildings)
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
  const vec3 DEEP = vec3(0.03, 0.065, 0.1);
  const vec3 FOAM = vec3(0.78, 0.88, 1.0);

  void main() {
    vec2 sp = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
    vec2 p = vec2(sp.x, sp.y + uScroll); // document space
    float depth = p.y - uTop;
    if (depth < -60.0) { gl_FragColor = vec4(0.0); return; }

    float W = uView.x;
    float side = p.x < W * 0.5 ? -1.0 : 1.0;
    float fromEdge = min(p.x, W - p.x);                       // 0 at the screen edge
    float fallW = mix(W * 0.09, W * 0.13, step(900.0, W));     // width of each waterfall
    float poolH = ${POOL_H.toFixed(1)};

    // ---- wet rock between the falls (where the content sits) ----
    float rock = fbm(p * vec2(0.006, 0.012) + 7.0);
    vec3 col = vec3(0.02, 0.026, 0.038) * (0.75 + 0.6 * rock);
    col += vec3(0.02, 0.03, 0.045) * smoothstep(0.55, 0.85, vnoise(vec2(p.x * 0.05, p.y * 0.01 - uTime * 0.5))); // trickles

    // ---- the pool: city lights reflected, flowing outward toward the falls ----
    if (depth < poolH) {
      float flow = uTime * 38.0;
      vec2 q = vec2(p.x + side * flow, p.y);
      float surf = fbm(q * vec2(0.012, 0.06));
      vec3 water = DEEP * (0.8 + 0.5 * surf);
      // reflections of the lit windows above, wobbling on the surface
      float c34 = floor(p.x / 38.0);
      float h = hash(vec2(c34, 5.0));
      vec3 lc = h > 0.82 ? vec3(0.25, 0.42, 0.9) : WARM;
      float wob = sin(p.y * 0.08 + uTime * 1.6 + c34) * 3.0;
      float streak = smoothstep(0.5, 0.85, fbm(vec2((p.x + wob) * 0.06, p.y * 0.012 - uTime * 0.05)));
      water += lc * streak * step(0.45, h) * 0.35 * (1.0 - depth / poolH);
      // flow lines streaming toward each side
      float lines = smoothstep(0.62, 0.8, vnoise(vec2(q.x * 0.03, p.y * 0.25)));
      water += FOAM * lines * 0.05;
      // rain landing in the pool
      vec2 rc = floor(p / 60.0);
      vec2 rf = p - rc * 60.0 - 30.0;
      float age = fract(uTime * 0.9 + hash(rc) * 4.0);
      vec2 rpos = (vec2(hash(rc + 1.7), hash(rc + 3.1)) - 0.5) * 34.0;
      float ring = exp(-abs(length((rf - rpos) * vec2(1.0, 2.6)) - age * 20.0) * 1.3) * (1.0 - age);
      water += vec3(0.5, 0.6, 0.8) * ring * 0.18;
      // stone lip along the bottom of the pool, except where it pours over at the sides
      float lip = smoothstep(poolH - 10.0, poolH - 4.0, depth) * step(fallW + 24.0, fromEdge);
      water = mix(water, vec3(0.07, 0.08, 0.1) * (1.0 + 0.8 * (1.0 - smoothstep(poolH - 10.0, poolH - 7.0, depth))), lip);
      col = water;
    } else {
      // a soft line of spray just under the lip
      col += FOAM * 0.05 * exp(-(depth - poolH) / 30.0) * step(fallW + 24.0, fromEdge);
    }

    // ---- the waterfalls down both sides ----
    float fy = depth - poolH;
    float wobble = sin(p.y * 0.011 + uTime * 0.7 + side) * 7.0 + (vnoise(vec2(p.y * 0.015, uTime * 0.4 + side * 3.0)) - 0.5) * 18.0;
    // the falls widen a little as they drop, and curl over the lip at the top
    float edgeX = fallW + wobble + min(fy, 600.0) * 0.03;
    float lipCurve = smoothstep(-40.0, 30.0, fy);
    float inFall = (1.0 - smoothstep(edgeX - 14.0, edgeX, fromEdge)) * lipCurve;
    if (inFall > 0.001) {
      float speed = 330.0;
      float yy = p.y - uTime * speed;
      float sx = fromEdge;
      float streaks = fbm(vec2(sx * 0.07, yy * 0.006));
      float fine = vnoise(vec2(sx * 0.35, yy * 0.04));
      vec3 fall = mix(DEEP * 1.3, vec3(0.3, 0.45, 0.6), smoothstep(0.35, 0.8, streaks));
      fall += FOAM * smoothstep(0.78, 0.95, fine) * 0.55;
      // whiter, frothier water where it pours over the lip and along its outer edge
      float froth = exp(-max(fy, 0.0) / 70.0) + smoothstep(edgeX - 26.0, edgeX - 4.0, sx) * 0.6;
      fall = mix(fall, FOAM * (0.75 + 0.25 * fine), clamp(froth * (0.4 + 0.6 * fine), 0.0, 1.0) * 0.7);
      // the city's light glinting down the falling water
      float glint = step(0.85, hash(vec2(floor(sx / 9.0), side))) * smoothstep(0.6, 0.9, fbm(vec2(sx * 0.2, yy * 0.01 + 3.0)));
      fall += WARM * glint * 0.25;
      // darker toward the screen edge, so the falls have some roundness
      fall *= 0.7 + 0.3 * smoothstep(0.0, edgeX * 0.6, sx);
      col = mix(col, fall, inFall);
    }
    // mist rising off the falls into the rock face
    float mistD = max(fromEdge - edgeX, 0.0);
    float mist = exp(-mistD / 45.0) * (0.12 + 0.1 * vnoise(vec2(p.x * 0.01 - uTime * 0.2 * side, p.y * 0.008 - uTime * 0.15))) * lipCurve;
    col += vec3(0.4, 0.5, 0.65) * mist * (1.0 - inFall);

    // ---- the cursor: ripples in the pool, splashes in the falls ----
    for (int i = 0; i < MAXR; i++) {
      vec3 r = uRip[i];
      float t = uNow - r.z;
      if (t < 0.0 || t > 1.8) continue;
      float rDepth = r.y - uTop;
      float k = 1.0 - t / 1.8;
      if (rDepth < poolH) {
        float dist = length((p - r.xy) * vec2(1.0, 2.2));
        float rad = t * 80.0;
        float w = exp(-abs(dist - rad) / 2.2) + exp(-abs(dist - rad * 0.6) / 2.0) * 0.5;
        col += vec3(0.6, 0.75, 1.0) * w * k * 0.2 * step(depth, poolH);
      } else {
        // a burst of foam where the cursor touches the falling water, carried downward
        vec2 c = r.xy + vec2(0.0, t * 160.0);
        float dist = length((p - c) * vec2(1.0, 0.6));
        col += FOAM * exp(-dist / (10.0 + t * 20.0)) * k * 0.5 * inFall;
      }
    }

    col += vec3(0.3, 0.33, 0.45) * uFlash * 0.3;
    float alpha = smoothstep(-60.0, 80.0, depth);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Waterfalls() {
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
    // nothing to draw until the water has scrolled near the screen
    const visible = Number.isFinite(top) && top - window.scrollY < size.height + 60;
    m.visible = visible;
    if (!visible) return;

    const k = worldPerPixel(size.height, WATER_Z);
    m.position.set(0, 0, WATER_Z);
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
