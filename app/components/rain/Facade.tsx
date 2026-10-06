"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";

// Sits behind the scattered image particles (which reach z ≈ -1.35) so they float "inside" the rooms
const FACADE_Z = -1.6;
const ROOF_ABOVE = 70; // px of wall + cornice above the first row of windows
const BELOW = 150; // px of wall under the last row (captions sit here)
const FADE = 220; // px the building fades out over at the bottom

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Everything is computed in client px so the window lattice lines up with the DOM panes exactly.
const fragmentShader = /* glsl */ `
  uniform vec4 uRect;    // facade left, top, width, height (px)
  uniform vec2 uOrigin;  // top-left of the first project pane (px)
  uniform vec2 uWin;     // pane size (px)
  uniform vec2 uPitch;   // lattice spacing (px)
  uniform float uMargin; // frame + sill size (px)
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

  float rowOk(float cy) { return step(-0.5, cy) * step(cy, uRows - 0.5); }
  float isProject(vec2 c) {
    return step(-0.5, c.x) * step(c.x, uCols - 0.5) * step(c.y * uCols + c.x, uCount - 0.5) * rowOk(c.y);
  }
  // how strongly a window's room light spills onto the wall
  float roomLight(vec2 c) {
    float h = hash(c + 7.0);
    return rowOk(c.y) * max(isProject(c), step(0.5, h) * 0.7);
  }

  void main() {
    vec2 p = vec2(uRect.x + vUv.x * uRect.z, uRect.y + (1.0 - vUv.y) * uRect.w);

    // ---- wet brick wall ----
    vec2 bsz = vec2(30.0, 12.0);
    float brow = floor(p.y / bsz.y);
    vec2 bp = vec2(p.x / bsz.x + mod(brow, 2.0) * 0.5, p.y / bsz.y);
    vec2 bid = floor(bp);
    vec2 bf = fract(bp);
    float mpx = min(min(bf.x, 1.0 - bf.x) * bsz.x, min(bf.y, 1.0 - bf.y) * bsz.y);
    float mortar = 1.0 - smoothstep(0.5, 1.4, mpx);
    vec3 brick = mix(vec3(0.13, 0.075, 0.065), vec3(0.19, 0.11, 0.085), hash(bid));
    vec3 wall = mix(brick, vec3(0.06, 0.06, 0.065), mortar);
    // rain-darkened streaks and a slow sheen of water running down
    wall *= mix(0.65, 1.0, vnoise(vec2(p.x * 0.035, p.y * 0.004)));
    wall += vec3(0.03, 0.04, 0.055) * smoothstep(0.55, 0.9, vnoise(vec2(p.x * 0.05, p.y * 0.012 - uTime * 0.6)));

    // ---- window lattice ----
    vec2 rel = p - uOrigin + uMargin;
    vec2 cell = floor(rel / uPitch);
    vec2 lp = rel - cell * uPitch - uMargin; // pane occupies [0, uWin]
    float ok = rowOk(cell.y);
    float proj = isProject(cell);
    vec2 wuv = lp / uWin;
    float inWin = ok * step(0.0, lp.x) * step(lp.x, uWin.x) * step(0.0, lp.y) * step(lp.y, uWin.y);

    // warm light spilling from nearby rooms (check neighbours so it doesn't cut off at cell edges)
    float glow = 0.0;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 c = cell + vec2(float(dx), float(dy));
        vec2 l = rel - c * uPitch - uMargin;
        vec2 o = max(max(-l, l - uWin), 0.0);
        glow += exp(-length(o) / 28.0) * roomLight(c);
      }
    }
    vec3 warm = vec3(1.0, 0.62, 0.3);
    vec3 col = wall + warm * glow * 0.09 * (1.0 - inWin);

    // frame, lintel, sill
    vec2 o = max(-lp, lp - uWin);
    float od = max(o.x, o.y);
    float fw = uMargin * 0.55;
    float frame = ok * (1.0 - inWin) * step(od, fw);
    float spanX = step(-uMargin, lp.x) * step(lp.x, uWin.x + uMargin);
    float sill = ok * spanX * step(uWin.y + fw * 0.6, lp.y) * step(lp.y, uWin.y + uMargin);
    float sillShadow = ok * spanX * step(uWin.y + uMargin, lp.y) * (1.0 - smoothstep(0.0, 26.0, lp.y - uWin.y - uMargin));
    float lintel = ok * step(-uMargin * 1.3, lp.y) * step(lp.y, -fw) * step(-uMargin * 0.7, lp.x) * step(lp.x, uWin.x + uMargin * 0.7);

    vec3 stone = vec3(0.36, 0.34, 0.32);
    col = mix(col, stone * 0.55 + warm * glow * 0.05, lintel);
    col *= 1.0 - sillShadow * 0.55;
    vec3 frameCol = vec3(0.5, 0.49, 0.46) * (0.45 + glow * 0.25);
    col = mix(col, frameCol, frame);
    float sillTop = 1.0 - smoothstep(0.0, 2.5, lp.y - uWin.y - fw * 0.6);
    col = mix(col, stone * (0.6 + sillTop * 0.5) + warm * glow * 0.06, sill);

    // ---- what's behind each window ----
    if (inWin > 0.5) {
      float h = hash(cell + 7.0);
      vec3 room = vec3(0.45, 0.27, 0.12) * (1.05 - 0.75 * length((wuv - vec2(0.5, 0.35)) * vec2(1.0, 1.2)));
      if (proj > 0.5) {
        // project rooms: warm light behind the fogged glass
        col = room;
      } else {
        vec3 inside;
        if (h > 0.56) {
          // lit apartment with curtains
          float curtain = smoothstep(0.24, 0.2, wuv.x) + smoothstep(0.76, 0.8, wuv.x);
          float folds = 0.75 + 0.25 * sin(wuv.x * 90.0);
          inside = mix(room * 0.85, vec3(0.32, 0.1, 0.07) * folds, clamp(curtain, 0.0, 1.0));
        } else if (h > 0.5) {
          // someone watching TV
          float flick = 0.6 + 0.4 * sin(uTime * 7.0 + h * 50.0) * sin(uTime * 3.1 + h * 20.0);
          inside = vec3(0.09, 0.15, 0.32) * flick * (1.1 - length(wuv - 0.5));
        } else {
          // dark room reflecting the sky
          inside = vec3(0.025, 0.03, 0.045) + vec3(0.05, 0.06, 0.08) * (1.0 - wuv.y) * 0.6;
          inside += vec3(0.06) * smoothstep(0.05, 0.0, abs(wuv.x - wuv.y * 0.5 - 0.35));
        }
        // mullions on the ordinary windows
        float bar = step(abs(wuv.x - 0.5) * uWin.x, 2.5) + step(abs(wuv.y - 0.4) * uWin.y, 2.5);
        inside = mix(inside, frameCol, clamp(bar, 0.0, 1.0));
        col = inside;
      }
    }

    // ---- cornice along the roofline ----
    float ty = p.y - uRect.y;
    float cornice = 1.0 - step(18.0, ty);
    col = mix(col, stone * (0.55 + (1.0 - smoothstep(0.0, 3.0, ty)) * 0.5), cornice);
    col *= 1.0 - 0.5 * step(18.0, ty) * (1.0 - smoothstep(18.0, 46.0, ty));

    // lightning lights up the wall
    col += vec3(0.35, 0.38, 0.5) * uFlash * 0.45 * (1.0 - inWin * 0.6);

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
    const margin = THREE.MathUtils.clamp((pitchX - r0.width) / 2 - 1, 4, 14);

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
