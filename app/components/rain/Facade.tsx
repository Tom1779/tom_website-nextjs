"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";

// Sits behind the scattered image particles (which reach z ≈ -1.35) so they float "inside" the rooms
const FACADE_Z = -1.6;
const ROOF_ABOVE = 70; // px of wall + parapet above the first row of windows
const BELOW = 150; // px of wall under the last row (captions sit here)
const FADE = 220; // px the building fades out over at the bottom

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Modern apartment tower (slate concrete grid, balconies, warm rooms). Everything is computed in
// client px so the lattice lines up with the DOM panes exactly.
const fragmentShader = /* glsl */ `
  uniform vec4 uRect;    // facade left, top, width, height (px)
  uniform vec2 uOrigin;  // top-left of the first project pane (px)
  uniform vec2 uWin;     // pane size (px)
  uniform vec2 uPitch;   // lattice spacing (px)
  uniform float uMargin; // half the gap between panes (px): the structural columns
  uniform float uCols;
  uniform float uRows;
  uniform float uCount;
  uniform float uTime;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float box(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }
  float disc(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(r - 0.8, r + 0.8, length(p - c)); }

  float rowOk(float cy) { return step(-0.5, cy) * step(cy, uRows - 0.5); }
  float isProject(vec2 c) {
    return step(-0.5, c.x) * step(c.x, uCols - 0.5) * step(c.y * uCols + c.x, uCount - 0.5) * rowOk(c.y);
  }

  const vec3 FRAME = vec3(0.055, 0.06, 0.075);
  const vec3 SLAB = vec3(0.2, 0.22, 0.27);

  vec3 litColor(vec2 id) {
    return mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.85, 0.6), hash(id + 3.0)) * mix(0.75, 1.05, hash(id + 4.0));
  }

  // One apartment unit. p is px inside the glazing (0,0 = top-left), s its size.
  vec3 unit(vec2 p, vec2 s, vec2 id) {
    vec2 u = p / s;
    float h = hash(id);
    float lit = step(0.6, h);
    vec3 col;
    if (lit > 0.5) {
      vec3 lc = litColor(id);
      col = lc * (0.5 + 0.45 * (1.0 - u.y));
      col += lc * 0.35 * exp(-length((u - vec2(0.5, 0.06)) * vec2(1.4, 3.0)) * 2.5); // ceiling light
    } else {
      col = vec3(0.03, 0.04, 0.065) + vec3(0.03, 0.04, 0.06) * (1.0 - u.y);
      col += vec3(0.05, 0.06, 0.08) * smoothstep(0.05, 0.0, abs(u.x - u.y * 0.45 - 0.25));
    }
    float base = s.y * 0.985;

    // a person on some lit balconies
    if (lit > 0.5 && hash(id + 21.0) > 0.84) {
      float H = s.y * 0.5;
      float x = s.x * mix(0.3, 0.7, hash(id + 22.0));
      float body = box(p, vec2(x - H * 0.1, base - H * 0.8), vec2(x + H * 0.1, base));
      body = max(body, disc(p, vec2(x, base - H * 0.8), H * 0.1));
      float head = disc(p, vec2(x, base - H * 0.98), H * 0.09);
      float torso = step(base - H * 0.8, p.y) * step(p.y, base - H * 0.4) * body;
      vec3 shirt = hash(id + 23.0) > 0.6 ? vec3(0.6, 0.1, 0.07) : vec3(0.05, 0.04, 0.04);
      col = mix(col, vec3(0.04, 0.035, 0.035), max(head, body));
      col = mix(col, shirt, torso);
    }

    // a potted plant on some balconies
    if (hash(id + 11.0) > 0.55) {
      float x = s.x * mix(0.15, 0.85, hash(id + 5.0));
      float r = s.y * mix(0.09, 0.13, hash(id + 6.0));
      float pot = box(p, vec2(x - r * 0.55, base - r * 0.9), vec2(x + r * 0.55, base));
      float leaves = max(max(disc(p, vec2(x, base - r * 1.9), r), disc(p, vec2(x - r * 0.7, base - r * 1.4), r * 0.75)),
                         disc(p, vec2(x + r * 0.7, base - r * 1.5), r * 0.7));
      vec3 green = lit > 0.5 ? vec3(0.07, 0.13, 0.05) : vec3(0.08, 0.17, 0.08);
      col = mix(col, green, leaves);
      col = mix(col, lit > 0.5 ? vec3(0.08, 0.07, 0.07) : vec3(0.45, 0.45, 0.47), pot);
    }

    // glass balustrade + rails across the lower part
    float rail = s.y * 0.68;
    float glassB = step(rail, p.y);
    col = mix(col, col * 0.7 + vec3(0.02, 0.025, 0.04), glassB * 0.45);
    float bars = (1.0 - step(2.0, abs(p.y - rail))) + (1.0 - step(0.8, abs(p.y - (rail + (base - rail) * 0.5))));
    col = mix(col, FRAME * 1.6, clamp(bars, 0.0, 1.0));

    // window frame and mullion
    float edge = min(min(p.x, s.x - p.x), min(p.y, s.y - p.y));
    float mull = 1.0 - step(1.2, abs(p.x - s.x * 0.62));
    col = mix(col, FRAME, max(1.0 - step(2.5, edge), mull * (1.0 - glassB)));
    return col;
  }

  void main() {
    vec2 p = vec2(uRect.x + vUv.x * uRect.z, uRect.y + (1.0 - vUv.y) * uRect.w);

    // slate concrete, darkened by rain, with water sheeting down it
    vec3 col = vec3(0.12, 0.135, 0.17) * mix(0.8, 1.05, vnoise(p * 0.02));
    col *= mix(0.75, 1.0, vnoise(vec2(p.x * 0.05, p.y * 0.004)));
    col += vec3(0.02, 0.03, 0.045) * smoothstep(0.6, 0.9, vnoise(vec2(p.x * 0.06, p.y * 0.012 - uTime * 0.6)));

    vec2 rel = p - uOrigin + uMargin;
    vec2 cell = floor(rel / uPitch);
    vec2 lp = rel - cell * uPitch - uMargin; // project pane occupies [0, uWin]
    float ok = rowOk(cell.y);
    float proj = isProject(cell);

    // structural columns between lattice columns (lighter, with a shaded edge)
    float inCol = 1.0 - step(0.0, lp.x) * step(lp.x, uWin.x);
    float colDist = lp.x < 0.0 ? -lp.x : lp.x - uWin.x;
    vec3 column = vec3(0.16, 0.18, 0.225) * (0.85 + 0.15 * smoothstep(0.0, uMargin, colDist));
    col = mix(col, column, inCol);

    if (ok > 0.5 && inCol < 0.5) {
      if (proj > 0.5) {
        if (lp.y >= 0.0 && lp.y <= uWin.y) {
          // project unit: warm room behind the fogged glass
          vec2 u = lp / uWin;
          vec3 lc = vec3(1.0, 0.72, 0.38);
          col = lc * (0.38 + 0.25 * (1.0 - u.y));
        } else {
          // floor slab under the project unit, then dark louvers behind the caption (keeps text readable)
          float slab = step(lp.y, uWin.y + 9.0);
          float lip = 1.0 - step(2.0, lp.y - uWin.y);
          float slat = step(0.55, fract(lp.y / 7.0));
          vec3 louver = vec3(0.07, 0.08, 0.1) * (0.8 + 0.45 * slat);
          col = mix(louver, SLAB * (1.0 + lip * 0.6), slab);
        }
      } else {
        // ordinary floors: 2 units across, several storeys per lattice cell
        float ny = max(2.0, floor(uPitch.y / (uWin.x * 0.42) + 0.5));
        vec2 us = vec2(uWin.x / 2.0, uPitch.y / ny);
        vec2 q = vec2(lp.x, lp.y + uMargin);
        vec2 uid = floor(q / us);
        vec2 uq = q - uid * us;
        float slabH = 8.0;
        float gap = 3.0;
        vec2 gid = cell * vec2(2.0, ny) + uid;
        if (uq.y > us.y - slabH) {
          float lip = 1.0 - step(2.0, uq.y - (us.y - slabH));
          col = SLAB * (1.0 + lip * 0.6);
        } else if (uq.x < gap || uq.x > us.x - gap) {
          col = column * 0.9;
        } else {
          col = unit(uq - vec2(gap, 0.0), vec2(us.x - gap * 2.0, us.y - slabH), gid);
        }
      }
    }

    // roof parapet
    float ty = p.y - uRect.y;
    col = mix(col, SLAB * (1.0 + (1.0 - step(2.0, ty)) * 0.8), 1.0 - step(14.0, ty));

    // lightning lights up the concrete
    col += vec3(0.35, 0.38, 0.5) * uFlash * 0.4;

    float alpha = 1.0 - smoothstep(uRect.y + uRect.w - ${FADE.toFixed(1)}, uRect.y + uRect.w, p.y);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Facade({ count }: { count: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uRect: { value: new THREE.Vector4() },
      uOrigin: { value: new THREE.Vector2() },
      uWin: { value: new THREE.Vector2(1, 1) },
      uPitch: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: 10 },
      uCols: { value: 1 },
      uRows: { value: 1 },
      uCount: { value: count },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    }),
    [count],
  );

  useFrame((state) => {
    const m = mesh.current;
    const u = matRef.current?.uniforms;
    const els = rainStore.panelEls;
    const first = els[0];
    if (!m || !u || !first) {
      if (m) m.visible = false;
      rainStore.roofY = NaN;
      return;
    }

    // Derive the lattice from the DOM grid
    const r0 = first.getBoundingClientRect();
    let cols = 1;
    for (let i = 1; i < count; i++) {
      const r = els[i]?.getBoundingClientRect();
      if (r && Math.abs(r.top - r0.top) < 2) cols++;
      else break;
    }
    const rows = Math.ceil(count / cols);
    const r1 = cols > 1 ? els[1]?.getBoundingClientRect() : null;
    const rDown = count > cols ? els[cols]?.getBoundingClientRect() : null;
    const pitchX = r1 ? r1.left - r0.left : r0.width + 32;
    const pitchY = rDown ? rDown.top - r0.top : r0.height + 140;
    const margin = Math.max(3, (pitchX - r0.width) / 2); // the structural columns between panes

    const top = r0.top - ROOF_ABOVE;
    const bottom = r0.top + (rows - 1) * pitchY + r0.height + BELOW + FADE;
    const left = -20;
    const width = size.width + 40;
    const height = bottom - top;
    rainStore.roofY = top;

    const visible = bottom > 0 && top < size.height;
    m.visible = visible;
    if (!visible) return;

    const k = worldPerPixel(size.height, FACADE_Z);
    const [cx, cy] = pxToWorld(left + width / 2, top + height / 2, size.width, size.height, FACADE_Z);
    m.position.set(cx, cy, FACADE_Z);
    m.scale.set(width * k, height * k, 1);

    u.uRect.value.set(left, top, width, height);
    u.uOrigin.value.set(r0.left, r0.top);
    u.uWin.value.set(r0.width, r0.height);
    u.uPitch.value.set(pitchX, pitchY);
    u.uMargin.value = margin;
    u.uCols.value = cols;
    u.uRows.value = rows;
    u.uCount.value = count;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = rainStore.flash;
  });

  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
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
