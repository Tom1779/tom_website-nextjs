"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";
import { umbrellaState } from "./Umbrella";

const DRY_SECONDS = 1.0; // time under the umbrella to fully dry a pane
const REFOG_SECONDS = 6.0; // a partly-dried pane fogs back up this slowly
const BG = [11, 18, 32]; // backdrop behind each project image (rgb)

// ---------------------------------------------------------------------------
// Wet glass
// ---------------------------------------------------------------------------

const glassVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glassFragment = /* glsl */ `
  uniform float uTime;
  uniform float uDry;
  uniform float uFlash;
  uniform float uShelter;
  uniform float uAspect;
  uniform float uSeed;
  uniform float uRain;
  uniform vec2 uPx; // 1 / panel size in px
  varying vec2 vUv;

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  // Beaded condensation drops that slowly form and evaporate. Returns mask + offset from centre.
  vec3 beads(vec2 q, float scale, float t, float seed) {
    vec2 g = q * scale;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float n = h21(id + seed);
    vec2 off = (vec2(n, fract(n * 34.1)) - 0.5) * 0.55;
    float r = mix(0.07, 0.22, fract(n * 91.7));
    float exists = step(0.55, fract(n * 13.3));
    float cyc = fract(t * 0.06 + n);
    float life = smoothstep(0.0, 0.15, cyc) * smoothstep(1.0, 0.8, cyc);
    vec2 d = f - off;
    float m = smoothstep(r, r * 0.65, length(d)) * exists * life;
    return vec3(m, d / r);
  }

  // Drops sliding down the pane, wiping a clear trail. Returns (drop, trail).
  vec2 sliders(vec2 q, float t, float seed) {
    float cols = 6.0;
    float cw = 1.0 / cols;
    float id = floor(q.x * cols);
    float n = h21(vec2(id, seed * 3.7));
    float live = step(0.35, n);
    float speed = 0.06 + n * 0.12;
    float top = 1.0 / max(uAspect, 0.001);
    // stick-slip: drops pause, then run
    float tt = t * speed + n * 7.0;
    float stick = floor(tt) + smoothstep(0.0, 1.0, fract(tt));
    float y = top * 1.2 - fract(stick * 0.35 + n) * (top * 1.5);
    float off = (n - 0.5) * 0.5 + sin(q.y * 18.0 + n * 6.28) * 0.07;
    float dx = (fract(q.x * cols) - 0.5 - off) * cw;
    float dy = q.y - y;
    float r = cw * 0.16;
    float drop = smoothstep(r, r * 0.55, length(vec2(dx, dy * 0.75))) * live;
    float trail = smoothstep(r * 0.55, r * 0.15, abs(dx)) * step(0.0, dy) * smoothstep(0.35, 0.0, dy) * live;
    return vec2(drop, trail);
  }

  void main() {
    vec2 uv = vUv;
    // square-ish space so drops stay round on any pane aspect
    vec2 q = vec2(uv.x, uv.y / max(uAspect, 0.001));
    float wet = 1.0 - uDry;

    // fog body with soft variation; heavier condensation near the bottom
    float body = fbm(q * 5.0 + uSeed * 10.0);
    float fogA = mix(0.6, 0.86, body) * mix(1.0, 1.08, smoothstep(0.4, 0.0, uv.y));

    // drying clears in blotchy patches rather than a uniform fade
    float evapN = fbm(q * 3.0 - uSeed * 4.0 + 0.3);
    float evap = clamp((evapN - (uDry * 1.35 - 0.2)) / 0.18, 0.0, 1.0);
    fogA *= evap;

    vec3 b1 = beads(q, 16.0, uTime, uSeed);
    vec3 b2 = beads(q + 0.37, 28.0, uTime * 1.3, uSeed + 9.0);
    vec2 s = sliders(q, uTime * mix(0.6, 1.4, uRain), uSeed);

    float drops = max(max(b1.x, b2.x * 0.8), s.x) * wet;
    float trail = s.y * wet;

    // drops and their trails cut through the fog
    fogA *= (1.0 - trail * 0.9) * (1.0 - drops * 0.85);
    // lightning makes the glass see-through for an instant
    fogA *= 1.0 - uFlash * 0.8;

    vec3 fogCol = vec3(0.22, 0.27, 0.36) + vec3(0.2, 0.22, 0.27) * body * 0.5;
    fogCol += vec3(0.95, 0.75, 0.5) * uShelter * 0.12; // a touch of warmth while sheltered

    // drop shading: dark rim, small specular highlight up-left
    vec2 dn = b1.x > b2.x ? b1.yz : b2.yz;
    float rim = drops * smoothstep(0.35, 0.95, length(dn));
    float spec = drops * smoothstep(0.35, 0.0, length(dn + vec2(0.35, -0.35)));
    spec = max(spec, s.x * wet * 0.2);

    // pane frame + faint diagonal sheen so the shape always reads
    vec2 edgePx = min(uv, 1.0 - uv) / uPx;
    float edge = min(edgePx.x, edgePx.y);
    float frame = smoothstep(2.0, 0.0, edge) * 0.55 + smoothstep(14.0, 0.0, edge) * 0.08;
    float sheen = smoothstep(0.08, 0.0, abs(uv.x + uv.y - 1.25)) * 0.06;

    vec3 frameCol = mix(vec3(0.7, 0.8, 0.95), vec3(1.0, 0.82, 0.55), uShelter);
    frameCol = mix(frameCol, vec3(1.0), uFlash);

    float aFog = fogA;
    float aRim = rim * 0.22;
    float aSpec = spec * 0.7;
    float aFrame = frame * (1.0 + uFlash + uShelter * 0.6) + sheen;

    float alpha = clamp(aFog + aRim + aSpec + aFrame, 0.0, 1.0);
    vec3 col = fogCol * aFog + vec3(0.55, 0.65, 0.8) * aRim + vec3(1.0) * aSpec + frameCol * aFrame;
    col /= max(aFog + aRim + aSpec + aFrame, 0.001);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Image particles (the "latent space" reveal)
// ---------------------------------------------------------------------------

const particleVertex = /* glsl */ `
  attribute vec3 aTarget;
  attribute vec3 aScatter;
  attribute vec3 aColor;
  attribute float aRnd;
  uniform float uDry;
  uniform float uTime;
  uniform float uSize;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float t = smoothstep(aRnd * 0.55, aRnd * 0.55 + 0.45, uDry);
    vec3 drift = vec3(
      sin(uTime * 0.7 + aRnd * 40.0),
      cos(uTime * 0.6 + aRnd * 31.0),
      sin(uTime * 0.5 + aRnd * 17.0)
    ) * 0.035 * (1.0 - t);
    vec3 p = mix(aTarget + aScatter + drift, aTarget, t);
    vColor = aColor;
    vAlpha = mix(0.6, 1.0, t) * uFade;
    gl_PointSize = uSize * mix(1.9, 1.05, t);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const particleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.28, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

interface PanelAsset {
  texture: THREE.CanvasTexture;
  geometry: THREE.BufferGeometry;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draws the image "contain"-fitted onto a square canvas and samples it into a particle cloud. */
async function buildAsset(src: string, grid: number): Promise<PanelAsset> {
  const img = await loadImage(src);
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${BG.join(",")})`;
  ctx.fillRect(0, 0, S, S);
  const iw = img.naturalWidth || img.width || S;
  const ih = img.naturalHeight || img.height || S;
  const pad = S * 0.08;
  const scale = Math.min((S - pad * 2) / iw, (S - pad * 2) / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // Downsample for particle colours
  const small = document.createElement("canvas");
  small.width = small.height = grid;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(canvas, 0, 0, grid, grid);
  const data = sctx.getImageData(0, 0, grid, grid).data;

  const targets: number[] = [];
  const scatter: number[] = [];
  const colors: number[] = [];
  const rnd: number[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const i = (y * grid + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const diff = Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]);
      if (diff < 24) continue; // skip empty backdrop so logos form their own silhouettes
      const u = (x + 0.5) / grid - 0.5;
      const v = 0.5 - (y + 0.5) / grid;
      targets.push(u, v, -0.15);
      // noisy cloud: mostly inside the pane, pushed back in depth
      const a = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 0.7) * 0.32;
      scatter.push(Math.cos(a) * rad - u * 0.5, Math.sin(a) * rad - v * 0.5, -Math.random() * 1.2);
      // shader materials write straight to the sRGB canvas, so keep colours in sRGB
      colors.push(r / 255, g / 255, b / 255);
      rnd.push(Math.random());
    }
  }
  const count = targets.length / 3;
  const geometry = new THREE.BufferGeometry();
  // position is unused by the shader but three needs it for draw count
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aTarget", new THREE.Float32BufferAttribute(targets, 3));
  geometry.setAttribute("aScatter", new THREE.Float32BufferAttribute(scatter, 3));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aRnd", new THREE.Float32BufferAttribute(rnd, 1));
  return { texture, geometry };
}

// ---------------------------------------------------------------------------

interface PanelProps {
  index: number;
  image: string;
  grid: number;
}

function Panel({ index, image, grid }: PanelProps) {
  const group = useRef<THREE.Group>(null);
  const imageMat = useRef<THREE.MeshBasicMaterial>(null);
  const glassMat = useRef<THREE.ShaderMaterial>(null);
  const particleMat = useRef<THREE.ShaderMaterial>(null);
  const [asset, setAsset] = useState<PanelAsset | null>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const visual = useRef({ dry: 0, shelter: 0 });

  useEffect(() => {
    let cancelled = false;
    let built: PanelAsset | null = null;
    buildAsset(image, grid)
      .then((a) => {
        if (cancelled) {
          a.texture.dispose();
          a.geometry.dispose();
          return;
        }
        built = a;
        setAsset(a);
      })
      .catch(() => {
        /* missing image: the pane still renders as plain glass */
      });
    return () => {
      cancelled = true;
      if (built) {
        built.texture.dispose();
        built.geometry.dispose();
      }
    };
  }, [image, grid]);

  const glassUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDry: { value: 0 },
      uFlash: { value: 0 },
      uShelter: { value: 0 },
      uAspect: { value: 1 },
      uSeed: { value: Math.random() * 10 },
      uRain: { value: 0.5 },
      uPx: { value: new THREE.Vector2(0.004, 0.004) },
    }),
    [],
  );
  const particleUniforms = useMemo(
    () => ({
      uDry: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 4 },
      uFade: { value: 1 },
    }),
    [],
  );

  useFrame((state, dt) => {
    const g = group.current;
    const el = rainStore.panelEls[index];
    if (!g || !el) return;
    const rect = el.getBoundingClientRect();
    const onScreen = rect.bottom > -50 && rect.top < size.height + 50 && rect.width > 0;
    g.visible = onScreen;
    if (!onScreen) return;

    const k = worldPerPixel(size.height, 0);
    const [cx, cy] = pxToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, size.width, size.height, 0);
    g.position.set(cx, cy, 0);
    g.scale.set(rect.width * k, rect.height * k, 1);

    const v = visual.current;
    const target = rainStore.dryness[index];
    // ease the shader value so drying looks smooth even when dryness jumps (reveal all / flash button)
    v.dry += (target - v.dry) * Math.min(1, dt * 5);
    const sheltered = rainStore.sheltered === index ? 1 : 0;
    v.shelter += (sheltered - v.shelter) * Math.min(1, dt * 6);

    const t = state.clock.elapsedTime;
    // R3F copies uniform values into the material, so update them through the material itself
    const gu = glassMat.current?.uniforms;
    if (gu) {
      gu.uTime.value = t;
      gu.uDry.value = v.dry;
      gu.uFlash.value = rainStore.flash;
      gu.uShelter.value = v.shelter;
      gu.uAspect.value = rect.width / rect.height;
      gu.uRain.value = rainStore.intensity;
      gu.uPx.value.set(1 / rect.width, 1 / rect.height);
    }

    const crisp = Math.max(THREE.MathUtils.smoothstep(v.dry, 0.86, 1.0), rainStore.flash * 0.75);
    const pu = particleMat.current?.uniforms;
    if (pu) {
      pu.uDry.value = v.dry;
      pu.uTime.value = t;
      pu.uSize.value = (rect.width / grid) * gl.getPixelRatio() * 1.2;
      pu.uFade.value = 1 - THREE.MathUtils.smoothstep(v.dry, 0.9, 1.0);
    }
    if (imageMat.current) imageMat.current.opacity = crisp;
  });

  return (
    <group ref={group}>
      {asset && (
        <>
          <mesh position={[0, 0, -0.16]} renderOrder={1}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              ref={imageMat}
              map={asset.texture}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <points geometry={asset.geometry} frustumCulled={false} renderOrder={2}>
            <shaderMaterial
              ref={particleMat}
              vertexShader={particleVertex}
              fragmentShader={particleFragment}
              uniforms={particleUniforms}
              transparent
              depthWrite={false}
            />
          </points>
        </>
      )}
      <mesh renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={glassMat}
          vertexShader={glassVertex}
          fragmentShader={glassFragment}
          uniforms={glassUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

interface PanelsProps {
  images: string[];
  grid: number;
  onReveal: (index: number) => void;
}

/** Owns the drying simulation for every pane and renders one Panel per project. */
export default function Panels({ images, grid, onReveal }: PanelsProps) {
  const lastDryCss = useRef<number[]>([]);

  useFrame((_, dt) => {
    dt = Math.min(dt, 1 / 20);
    const s = rainStore;

    if (s.refogRequested) {
      s.refogRequested = false;
      s.dryness.fill(0);
      s.revealed.fill(0);
      s.boost.fill(0);
    }
    if (s.revealAllRequested) {
      s.revealAllRequested = false;
      for (let i = 0; i < images.length; i++) {
        if (!s.revealed[i]) {
          s.revealed[i] = 1;
          onReveal(i);
        }
      }
    }

    // which pane is the umbrella over?
    let sheltered = -1;
    if (umbrellaState.open > 0.6) {
      for (let i = 0; i < images.length; i++) {
        const el = s.panelEls[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const m = 6;
        // the handle or the canopy centre counts as "over" the pane
        const gx = umbrellaState.gx;
        const ys = [umbrellaState.gy, umbrellaState.gy - umbrellaState.radiusPx * 0.9];
        if (gx > r.left - m && gx < r.right + m && ys.some((y) => y > r.top - m && y < r.bottom + m)) {
          sheltered = i;
          break;
        }
      }
    }
    s.sheltered = sheltered;

    for (let i = 0; i < images.length; i++) {
      if (s.revealed[i]) {
        s.dryness[i] = 1;
      } else {
        let d = s.dryness[i];
        if (i === sheltered) d += dt / DRY_SECONDS;
        else d -= dt / REFOG_SECONDS;
        if (s.boost[i] > 0) {
          d += s.boost[i] * dt;
          s.boost[i] = Math.max(0, s.boost[i] - dt * 2);
        }
        d = THREE.MathUtils.clamp(d, 0, 1);
        s.dryness[i] = d;
        if (d >= 1) {
          s.revealed[i] = 1;
          onReveal(i);
        }
      }

      // expose progress to the DOM (drying ring) without thrashing styles
      const el = s.panelEls[i];
      const prev = lastDryCss.current[i] ?? -1;
      if (el && Math.abs(prev - s.dryness[i]) > 0.01) {
        el.style.setProperty("--dry", s.dryness[i].toFixed(3));
        lastDryCss.current[i] = s.dryness[i];
      }
    }
  });

  return (
    <>
      {images.map((img, i) => (
        <Panel key={img + i} index={i} image={img} grid={grid} />
      ))}
    </>
  );
}
