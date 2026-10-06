"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";

const BG = [11, 18, 32]; // same backdrop the window poster uses

// Scrambled pixels of the project image drift over the frosted glass and swirl into the picture as
// the window dries; the crisp poster in the Skyline shader takes over at the very end.
const vertexShader = /* glsl */ `
  attribute vec2 aTarget;  // position in the square image tile (-0.5..0.5)
  attribute vec2 aScatter; // starting position inside the window (-0.5..0.5)
  attribute vec3 aColor;
  attribute float aRnd;
  uniform float uDry;
  uniform float uTime;
  uniform float uSize;
  uniform float uTileY;    // tile height as a fraction of the window height (tile is window-wide)
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float t = smoothstep(aRnd * 0.55, aRnd * 0.55 + 0.45, uDry);
    vec2 drift = vec2(sin(uTime * 0.8 + aRnd * 40.0), cos(uTime * 0.7 + aRnd * 31.0)) * 0.045 * (1.0 - t);
    vec2 target = vec2(aTarget.x, aTarget.y * uTileY);
    vec2 pos = mix(aScatter + drift, target, t);
    vColor = aColor;
    vAlpha = mix(0.42, 1.0, t) * uFade;
    gl_PointSize = uSize * mix(1.25, 1.05, t);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.01, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.25, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Sample an image ("contain"-fitted on the backdrop) into a cloud of coloured points. */
async function buildCloud(src: string, grid: number) {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = c.height = grid;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = `rgb(${BG.join(",")})`;
  ctx.fillRect(0, 0, grid, grid);
  const iw = img.naturalWidth || grid;
  const ih = img.naturalHeight || grid;
  const pad = grid * 0.08;
  const k = Math.min((grid - pad * 2) / iw, (grid - pad * 2) / ih);
  ctx.drawImage(img, (grid - iw * k) / 2, (grid - ih * k) / 2, iw * k, ih * k);
  const data = ctx.getImageData(0, 0, grid, grid).data;

  const target: number[] = [];
  const scatter: number[] = [];
  const color: number[] = [];
  const rnd: number[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const i = (y * grid + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]) < 24) continue; // skip backdrop
      target.push((x + 0.5) / grid - 0.5, 0.5 - (y + 0.5) / grid);
      scatter.push((Math.random() - 0.5) * 0.88, (Math.random() - 0.5) * 0.9);
      // shader output goes straight to the sRGB canvas, so keep the colours in sRGB
      color.push(r / 255, g / 255, b / 255);
      rnd.push(Math.random());
    }
  }
  const geo = new THREE.BufferGeometry();
  const n = rnd.length;
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("aTarget", new THREE.Float32BufferAttribute(target, 2));
  geo.setAttribute("aScatter", new THREE.Float32BufferAttribute(scatter, 2));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute("aRnd", new THREE.Float32BufferAttribute(rnd, 1));
  return geo;
}

function Cloud({ index, image, grid }: { index: number; image: string; grid: number }) {
  const points = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let cancelled = false;
    let built: THREE.BufferGeometry | null = null;
    buildCloud(image, grid)
      .then((g) => {
        if (cancelled) return g.dispose();
        built = g;
        setGeo(g);
      })
      .catch(() => {
        /* missing image: the window just reveals its poster */
      });
    return () => {
      cancelled = true;
      built?.dispose();
    };
  }, [image, grid]);

  const uniforms = useMemo(
    () => ({ uDry: { value: 0 }, uTime: { value: 0 }, uSize: { value: 3 }, uTileY: { value: 1 }, uFade: { value: 1 } }),
    [],
  );

  useFrame((state) => {
    const p = points.current;
    const u = matRef.current?.uniforms;
    const L = rainStore.layout;
    const el = rainStore.cityEl;
    if (!p || !u || !L || !el) return;
    const w = L.windows.find((x) => x.project === index);
    if (!w) {
      p.visible = false;
      return;
    }
    const dry = rainStore.shown[index];
    const fade = 1 - THREE.MathUtils.smoothstep(dry, 0.86, 1.0);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + w.x + w.w / 2;
    const cy = rect.top + w.y + w.h / 2;
    p.visible = fade > 0.01 && cy > -w.h && cy < size.height + w.h;
    if (!p.visible) return;

    const k = worldPerPixel(size.height, 0);
    const [x, y] = pxToWorld(cx, cy, size.width, size.height, 0);
    p.position.set(x, y, 0);
    p.scale.set(w.w * k, w.h * k, 1);

    u.uDry.value = dry;
    u.uTime.value = state.clock.elapsedTime;
    u.uSize.value = (w.w / grid) * gl.getPixelRatio() * 1.25;
    u.uTileY.value = w.w / w.h;
    u.uFade.value = fade * (1 - rainStore.flash * 0.8);
  });

  if (!geo) return null;
  return (
    <points ref={points} geometry={geo} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export default function WindowParticles({ images }: { images: string[] }) {
  // a pixel every ~3 px of window width keeps the "scrambled pixels" look at any size
  const grid = useMemo(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 22 : 30), []);
  return (
    <>
      {images.map((img, i) => (
        <Cloud key={img + i} index={i} image={img} grid={grid} />
      ))}
    </>
  );
}
