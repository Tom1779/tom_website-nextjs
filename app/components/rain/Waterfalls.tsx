"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore, MAX_RIPPLES } from "./store";
import { worldPerPixel } from "./quality";
import { POOL_H } from "./layout";

const WATER_Z = -30;
const LANTERN_PERIOD = 640; // px of scroll between lanterns on the same side

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Below the city the rain collects in a pool that pours over both sides of the screen as two
// waterfalls. Between them, under the pool's stone ledge, is a sheltered grotto: warm rock, fairy
// lights, hanging ivy, lanterns, glowing moss and fireflies that drift toward the cursor.
// Screen px + document y throughout.
const fragmentShader = /* glsl */ `
  #define MAXR ${MAX_RIPPLES}
  uniform vec2 uView;       // viewport px
  uniform float uScroll;    // window.scrollY
  uniform float uTop;       // document y where the water starts (under the buildings)
  uniform float uTime;
  uniform float uNow;       // seconds, same clock as the ripple timestamps
  uniform float uFlash;
  uniform vec2 uMouse;      // cursor in document px (x < 0 when unknown)
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
  const vec3 BULB = vec3(1.0, 0.82, 0.5);
  const vec3 DEEP = vec3(0.03, 0.065, 0.1);
  const vec3 FOAM = vec3(0.78, 0.88, 1.0);
  const vec3 MOSS = vec3(0.3, 1.0, 0.75);

  // A draped string of fairy lights between the falls; returns light (rgb) and wire coverage (a)
  vec4 fairyLights(vec2 p, float y0, float sag, float x0, float x1, float spacing, float seed) {
    float mid = 0.5 * (x0 + x1);
    float hw = 0.5 * (x1 - x0);
    float sway = sin(uTime * 0.6 + seed) * 2.0;
    float t = clamp((p.x - mid) / hw, -1.0, 1.0);
    float wireY = y0 + sag * (1.0 - t * t) + sway * (1.0 - t * t);
    float inSpan = step(x0, p.x) * step(p.x, x1);
    float wire = (1.0 - smoothstep(0.4, 1.2, abs(p.y - wireY))) * inSpan;
    vec3 light = vec3(0.0);
    float id = floor((p.x - x0) / spacing);
    for (int k = -1; k <= 1; k++) {
      float bi = id + float(k);
      float bx = x0 + (bi + 0.5) * spacing;
      if (bx < x0 || bx > x1) continue;
      float bt = (bx - mid) / hw;
      vec2 b = vec2(bx, y0 + sag * (1.0 - bt * bt) + sway * (1.0 - bt * bt) + 5.0);
      float d = length(p - b);
      float tw = 0.8 + 0.2 * sin(uTime * (1.5 + hash(vec2(bi, seed)) * 2.0) + bi);
      vec3 c = mix(BULB, vec3(1.0, 0.6, 0.35), hash(vec2(bi, seed + 3.0)));
      light += c * ((1.0 - smoothstep(2.2, 3.4, d)) * 1.4 + exp(-d / 9.0) * 0.55 + exp(-d / 60.0) * 0.06) * tw;
    }
    return vec4(light, wire);
  }

  void main() {
    vec2 sp = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
    vec2 p = vec2(sp.x, sp.y + uScroll); // document space
    float depth = p.y - uTop;
    if (depth < -60.0) { gl_FragColor = vec4(0.0); return; }

    float W = uView.x;
    float side = p.x < W * 0.5 ? -1.0 : 1.0;
    float fromEdge = min(p.x, W - p.x);                    // 0 at the screen edge
    float fallW = mix(W * 0.09, W * 0.13, step(900.0, W));  // width of each waterfall
    float poolH = ${POOL_H.toFixed(1)};
    float gy = depth - poolH;                               // px below the grotto ceiling
    vec3 col;

    if (depth < poolH) {
      // ---- the pool: city lights reflected, flowing outward toward the falls ----
      float flow = uTime * 38.0;
      vec2 q = vec2(p.x + side * flow, p.y);
      float surf = fbm(q * vec2(0.012, 0.06));
      col = DEEP * (0.8 + 0.5 * surf);
      float c38 = floor(p.x / 38.0);
      float h = hash(vec2(c38, 5.0));
      vec3 lc = h > 0.82 ? vec3(0.25, 0.42, 0.9) : WARM;
      float wob = sin(p.y * 0.08 + uTime * 1.6 + c38) * 3.0;
      float streak = smoothstep(0.5, 0.85, fbm(vec2((p.x + wob) * 0.06, p.y * 0.012 - uTime * 0.05)));
      col += lc * streak * step(0.45, h) * 0.35 * (1.0 - depth / poolH);
      col += FOAM * smoothstep(0.62, 0.8, vnoise(vec2(q.x * 0.03, p.y * 0.25))) * 0.05;
      vec2 rc = floor(p / 60.0);
      vec2 rf = p - rc * 60.0 - 30.0;
      float age = fract(uTime * 0.9 + hash(rc) * 4.0);
      vec2 rpos = (vec2(hash(rc + 1.7), hash(rc + 3.1)) - 0.5) * 34.0;
      col += vec3(0.5, 0.6, 0.8) * exp(-abs(length((rf - rpos) * vec2(1.0, 2.6)) - age * 20.0) * 1.3) * (1.0 - age) * 0.18;
    } else {
      // ---- the grotto ----
      // layered, warm rock; cooler and wetter toward the falls
      float strata = fbm(vec2(p.x * 0.004, p.y * 0.018) + 11.0);
      float rough = fbm(p * 0.025);
      col = mix(vec3(0.03, 0.024, 0.026), vec3(0.085, 0.064, 0.054), strata) * (0.7 + 0.6 * rough);
      col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 1.5, abs(fract(p.y / 46.0 + strata) - 0.5) * 8.0)) * 0.3; // bedding lines
      float nearFall = 1.0 - smoothstep(fallW, fallW * 2.6, fromEdge);
      col = mix(col, vec3(0.03, 0.045, 0.06) * (0.8 + 0.5 * rough), nearFall * 0.8);
      // warm glow filling the middle of the cave
      col += WARM * 0.05 * exp(-pow((p.x - W * 0.5) / (W * 0.45), 2.0)) * smoothstep(0.0, 300.0, gy);

      // fairy lights draped under the ceiling
      float x0 = fallW + 30.0;
      float x1 = W - fallW - 30.0;
      vec4 s1 = fairyLights(p, uTop + poolH + 18.0, 70.0, x0, x1, 44.0, 1.0);
      vec4 s2 = fairyLights(p, uTop + poolH + 10.0, 120.0, x0 + 60.0, x1 - 60.0, 52.0, 7.0);
      col = mix(col, vec3(0.04, 0.035, 0.03), clamp(s1.a + s2.a, 0.0, 1.0));
      col += s1.rgb + s2.rgb;

      // ivy hanging from the ledge, swaying, lit by the lights
      float vc = floor(p.x / 70.0);
      float vh = hash(vec2(vc, 21.0));
      if (vh > 0.45 && p.x > fallW + 20.0 && p.x < W - fallW - 20.0) {
        float len = 60.0 + vh * 170.0;
        float vx = (vc + 0.5) * 70.0 + (hash(vec2(vc, 22.0)) - 0.5) * 30.0;
        float sw = sin(uTime * 0.8 + vc) * 5.0 * (gy / len);
        float dx = p.x - vx - sw;
        float stem = (1.0 - smoothstep(0.6, 1.4, abs(dx))) * step(gy, len);
        float lseg = floor(gy / 13.0);
        float lside = mod(lseg, 2.0) * 2.0 - 1.0;
        vec2 lc = vec2(vx + sw + lside * 5.0, (lseg + 0.5) * 13.0);
        float leaf = (1.0 - smoothstep(0.8, 1.0, length((vec2(p.x, gy) - lc) / vec2(5.0, 3.2)))) * step(gy, len + 4.0);
        float ivy = max(stem, leaf);
        vec3 ivyCol = vec3(0.06, 0.13, 0.06) + WARM * 0.1 * exp(-gy / 120.0);
        col = mix(col, ivyCol, ivy * 0.95);
      }

      // the underside of the ledge, with little stalactites and the odd drip falling
      float sc = floor(p.x / 26.0);
      float sh = hash(vec2(sc, 3.0));
      float sl = sh * 22.0;
      float sdx = abs(p.x - (sc + 0.5) * 26.0) / 9.0;
      float stal = step(gy, sl * (1.0 - sdx)) * step(0.4, sh);
      float ledge = 1.0 - smoothstep(0.0, 8.0, gy);
      col = mix(col, vec3(0.07, 0.065, 0.07), max(ledge, stal));
      if (sh > 0.75) {
        float dy = mod(uTime * 140.0 + sh * 500.0, 520.0);
        float drip = (1.0 - smoothstep(0.8, 1.6, abs(p.x - (sc + 0.5) * 26.0))) * (1.0 - smoothstep(0.0, 7.0, abs(gy - sl - dy)));
        col += FOAM * drip * 0.5;
      }

      // lanterns on the rock beside each waterfall, all the way down
      float lx = side < 0.0 ? fallW + 42.0 : W - fallW - 42.0;
      float local = gy - 360.0 + (side < 0.0 ? 0.0 : ${(LANTERN_PERIOD / 2).toFixed(1)}) + 240.0;
      float kL = floor(local / ${LANTERN_PERIOD.toFixed(1)});
      if (kL >= 0.0) {
        float ly = uTop + poolH + 360.0 - (side < 0.0 ? 0.0 : ${(LANTERN_PERIOD / 2).toFixed(1)}) + kL * ${LANTERN_PERIOD.toFixed(1)};
        vec2 lp = p - vec2(lx, ly);
        float body = step(abs(lp.x), 7.0) * step(-10.0, lp.y) * step(lp.y, 10.0);
        float cap = step(abs(lp.x), 9.0 - (lp.y + 14.0) * 0.6) * step(-15.0, lp.y) * step(lp.y, -10.0);
        float bracket = step(abs(lp.y + 18.0), 1.2) * step(0.0, (lp.x) * side) * step(abs(lp.x), 16.0);
        float flick = 0.88 + 0.12 * sin(uTime * 9.0 + kL * 3.0) * sin(uTime * 5.3 + side);
        col = mix(col, vec3(0.06, 0.05, 0.045), clamp(cap + bracket, 0.0, 1.0));
        col = mix(col, BULB * 1.25 * flick, body * 0.9);
        float d = length(lp);
        col += WARM * (exp(-d / 18.0) * 0.6 + exp(-d / 120.0) * 0.16) * flick * (1.0 - body);
      }

      // bioluminescent moss where the spray keeps the rock wet
      float mossBand = smoothstep(fallW + 40.0, fallW + 4.0, fromEdge) * step(fallW - 10.0, fromEdge);
      float speck = step(0.93, hash(floor(p / 3.0))) * smoothstep(0.45, 0.8, fbm(p * 0.02 + 4.0));
      col += MOSS * speck * mossBand * (0.5 + 0.5 * sin(uTime * 1.3 + hash(floor(p / 3.0)) * 20.0)) * 0.6;

      // fireflies drifting through the cave, drawn toward the cursor
      vec2 fc = floor(p / 150.0);
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          vec2 cell = fc + vec2(float(i), float(j));
          float h = hash(cell + 51.0);
          if (h < 0.35) continue;
          vec2 fp = (cell + 0.5) * 150.0 + vec2(sin(uTime * (0.3 + h * 0.4) + h * 30.0), cos(uTime * (0.25 + h * 0.3) + h * 17.0)) * 55.0;
          if (fp.y < uTop + poolH + 40.0) continue;
          if (uMouse.x >= 0.0) {
            vec2 toM = uMouse - fp;
            fp += toM * 0.45 * exp(-length(toM) / 220.0);
          }
          float blink = smoothstep(0.2, 1.0, sin(uTime * (0.8 + h) + h * 40.0));
          float d = length(p - fp);
          col += vec3(0.9, 1.0, 0.55) * ((1.0 - smoothstep(1.2, 2.2, d)) + exp(-d / 9.0) * 0.5) * blink;
        }
      }
    }

    // ---- the waterfalls down both sides ----
    float fy = depth - poolH;
    float wobble = sin(p.y * 0.011 + uTime * 0.7 + side) * 7.0 + (vnoise(vec2(p.y * 0.015, uTime * 0.4 + side * 3.0)) - 0.5) * 18.0;
    float edgeX = fallW + wobble + min(max(fy, 0.0), 600.0) * 0.03;
    float lipCurve = smoothstep(-40.0, 30.0, fy);
    float inFall = (1.0 - smoothstep(edgeX - 14.0, edgeX, fromEdge)) * lipCurve;
    if (inFall > 0.001) {
      float yy = p.y - uTime * 330.0;
      float sx = fromEdge;
      float streaks = fbm(vec2(sx * 0.07, yy * 0.006));
      float fine = vnoise(vec2(sx * 0.35, yy * 0.04));
      vec3 fall = mix(DEEP * 1.3, vec3(0.3, 0.45, 0.6), smoothstep(0.35, 0.8, streaks));
      fall += FOAM * smoothstep(0.78, 0.95, fine) * 0.55;
      float froth = exp(-max(fy, 0.0) / 70.0) + smoothstep(edgeX - 26.0, edgeX - 4.0, sx) * 0.6;
      fall = mix(fall, FOAM * (0.75 + 0.25 * fine), clamp(froth * (0.4 + 0.6 * fine), 0.0, 1.0) * 0.7);
      float glint = step(0.85, hash(vec2(floor(sx / 9.0), side))) * smoothstep(0.6, 0.9, fbm(vec2(sx * 0.2, yy * 0.01 + 3.0)));
      fall += WARM * glint * 0.25;
      // the grotto's warm light catches the inner edge of the falls
      fall += WARM * 0.18 * smoothstep(edgeX - 30.0, edgeX, sx) * step(0.0, fy);
      fall *= 0.7 + 0.3 * smoothstep(0.0, edgeX * 0.6, sx);
      col = mix(col, fall, inFall);
    }
    // mist rising off the falls
    float mistD = max(fromEdge - edgeX, 0.0);
    float mist = exp(-mistD / 45.0) * (0.12 + 0.1 * vnoise(vec2(p.x * 0.01 - uTime * 0.2 * side, p.y * 0.008 - uTime * 0.15))) * lipCurve;
    col += vec3(0.4, 0.5, 0.65) * mist * (1.0 - inFall);

    // ---- the cursor: ripples in the pool, splashes in the falls ----
    for (int i = 0; i < MAXR; i++) {
      vec3 r = uRip[i];
      float t = uNow - r.z;
      if (t < 0.0 || t > 1.8) continue;
      float k = 1.0 - t / 1.8;
      if (r.y - uTop < poolH) {
        float dist = length((p - r.xy) * vec2(1.0, 2.2));
        float rad = t * 80.0;
        float w = exp(-abs(dist - rad) / 2.2) + exp(-abs(dist - rad * 0.6) / 2.0) * 0.5;
        col += vec3(0.6, 0.75, 1.0) * w * k * 0.2 * step(depth, poolH);
      } else {
        vec2 c = r.xy + vec2(0.0, t * 160.0);
        float dist = length((p - c) * vec2(1.0, 0.6));
        col += FOAM * exp(-dist / (10.0 + t * 20.0)) * k * 0.5 * inFall;
      }
    }

    col += vec3(0.3, 0.33, 0.45) * uFlash * 0.25;
    gl_FragColor = vec4(col, smoothstep(-60.0, 80.0, depth));
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
      uMouse: { value: new THREE.Vector2(-1, -1) },
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

    const ptr = rainStore.pointer;
    u.uView.value.set(size.width, size.height);
    u.uScroll.value = window.scrollY;
    u.uTop.value = top;
    u.uTime.value = state.clock.elapsedTime;
    u.uNow.value = performance.now() / 1000;
    u.uFlash.value = rainStore.flash;
    u.uMouse.value.set(ptr.seen ? ptr.x : -1, ptr.y + window.scrollY);
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
