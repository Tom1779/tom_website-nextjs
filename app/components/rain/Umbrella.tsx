"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";

const UMB_Z = 3;
const RIBS = 8;
// Shaft length from grip to canopy rim, in canopy radii
const SHAFT = 0.95;

/** Live umbrella state, read by Rain (shelter) and Panels (drying). */
export const umbrellaState = {
  gx: -9999, // grip position, client px
  gy: -9999,
  vx: 0, // px / s
  tilt: 0, // radians, positive = canopy leans left
  open: 0, // 0 folded .. 1 open
  // canopy rim centre and size, in world units on the z = 0 plane (for the rain shader)
  rimX: 0,
  rimY: 0,
  radius: 1,
  height: 0.4,
  radiusPx: 80,
};

const PHI_MAX = 1.12; // how far the dome extends from the tip, in radians

/** Point on the dome (rim radius 1, rim at y = 0) for u = 0 at the tip .. 1 at the rim. */
function domePoint(u: number, theta: number, out = new THREE.Vector3()) {
  const rimR = Math.sin(PHI_MAX);
  const phi = u * PHI_MAX;
  // between ribs the fabric edge lifts slightly, giving the scalloped rim
  const scallop = 1 - Math.abs(Math.cos((theta * RIBS) / 2));
  const y = Math.cos(phi) - Math.cos(PHI_MAX) + 0.08 * scallop * u ** 4;
  const r = Math.sin(phi) * (1 - 0.03 * scallop * u);
  return out.set((r * Math.cos(theta)) / rimR, y / rimR, (r * Math.sin(theta)) / rimR);
}

function buildCanopy() {
  const segT = 64;
  const segU = 20;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    for (let it = 0; it <= segT; it++) {
      const theta = (it / segT) * Math.PI * 2;
      domePoint(u, theta, v);
      positions.push(v.x, v.y, v.z);
      uvs.push(it / segT, u);
    }
  }
  for (let iu = 0; iu < segU; iu++) {
    for (let it = 0; it < segT; it++) {
      const a = iu * (segT + 1) + it;
      const b = a + segT + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const height = (1 - Math.cos(PHI_MAX)) / Math.sin(PHI_MAX);
  return { geo, height };
}

const canopyVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * mv;
  }
`;

// Clear vinyl: mostly see-through, brighter at grazing angles, white ribs and rim, beaded with rain.
const canopyFragment = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform float uRain;
  uniform float uBack;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vV);
    float ndv = abs(dot(N, V));
    float fres = pow(1.0 - ndv, 3.0);

    float u = vUv.y;
    float theta = vUv.x * 6.2831853;
    float rimR = sin(${PHI_MAX.toFixed(4)});
    float r = sin(u * ${PHI_MAX.toFixed(4)}) / rimR; // distance from the shaft, in canopy radii

    // ribs: white lines along each seam
    float seg = 6.2831853 / ${RIBS.toFixed(1)};
    float dTheta = abs(mod(theta + seg * 0.5, seg) - seg * 0.5);
    float rib = 1.0 - smoothstep(0.008, 0.02, dTheta * r);
    // rim piping
    float rim = smoothstep(0.955, 0.985, u);

    // raindrops: beads that land, sit, then slide off
    vec2 q = vec2(theta * r * 2.2, u * 2.0) * 9.0;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float n = hash(id);
    float cyc = fract(uTime * (0.25 + 0.35 * n) * (0.6 + uRain) + n * 13.0);
    vec2 c = vec2((fract(n * 31.7) - 0.5) * 0.5, (fract(n * 7.3) - 0.5) * 0.4 + smoothstep(0.7, 1.0, cyc) * 0.9);
    float rad = mix(0.1, 0.24, fract(n * 91.3));
    float alive = step(0.35, n) * smoothstep(0.0, 0.08, cyc) * (1.0 - smoothstep(0.85, 1.0, cyc));
    vec2 d = f - c;
    float bead = smoothstep(rad, rad * 0.55, length(d)) * alive;
    float beadHi = smoothstep(rad * 0.5, 0.0, length(d + vec2(rad * 0.35, -rad * 0.35))) * alive;

    // specular sheen from a soft light up and to the left
    vec3 L = normalize(vec3(-0.4, 0.85, 0.5));
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 48.0);

    float aBase = 0.05 + fres * 0.45;
    float aBead = bead * 0.28 + beadHi * 0.6;
    float aRib = rib * 0.7;
    float aRim = rim * 0.85;
    float aSpec = spec * 0.55;
    float alpha = aBase + aBead + aRib + aRim + aSpec;

    vec3 col = vec3(0.75, 0.85, 0.95) * aBase + vec3(0.85, 0.92, 1.0) * aBead
             + vec3(0.95) * (aRib + aRim) + vec3(1.0) * aSpec;
    col /= max(alpha, 0.001);
    col += vec3(0.4, 0.45, 0.6) * uFlash;
    alpha = clamp(alpha * (1.0 + uFlash) * uBack, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Umbrella({ splashCount }: { splashCount: number }) {
  const size = useThree((s) => s.size);
  const outer = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Group>(null);
  const sim = useRef({ x: -9999, y: -9999, vx: 0, vy: 0, tilt: 0, vtilt: 0, init: false });

  const backMat = useRef<THREE.ShaderMaterial>(null);
  const frontMat = useRef<THREE.ShaderMaterial>(null);

  const canopy = useMemo(buildCanopy, []);
  useEffect(
    () => () => {
      canopy.geo.dispose();
    },
    [canopy],
  );
  const backUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uFlash: { value: 0 }, uRain: { value: 0.5 }, uBack: { value: 0.6 } }),
    [],
  );
  const frontUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uFlash: { value: 0 }, uRain: { value: 0.5 }, uBack: { value: 1 } }),
    [],
  );

  // Splash particle pool (positions in client px, converted to world each frame)
  const splash = useMemo(() => {
    const n = splashCount;
    return {
      n,
      px: new Float32Array(n * 2),
      v: new Float32Array(n * 2),
      life: new Float32Array(n),
      geo: (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        return g;
      })(),
      spawnAcc: 0,
      cursor: 0,
    };
  }, [splashCount]);
  useEffect(() => () => splash.geo.dispose(), [splash]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30);
    const s = sim.current;
    const ptr = rainStore.pointer;
    const radiusPx = size.width < 768 ? 62 : 82;
    umbrellaState.radiusPx = radiusPx;

    // Over a pane that's already dry (clickable), the umbrella folds away and the hand cursor shows
    const active = ptr.planted || (ptr.inside && ptr.seen && ptr.overLink < 0);
    const tx = ptr.x;
    const ty = ptr.planted ? ptr.docY - window.scrollY : ptr.y;

    if (!s.init) {
      // until first contact, sit at rest on the pointer so the spring can't build up velocity
      s.x = tx;
      s.y = ty;
      s.vx = s.vy = s.vtilt = 0;
      s.init = ptr.seen || ptr.planted;
    }

    // Critically-damped-ish spring toward the pointer
    const k = 170;
    const c = 2 * Math.sqrt(k) * 0.75;
    s.vx += (k * (tx - s.x) - c * s.vx) * dt;
    s.vy += (k * (ty - s.y) - c * s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Tilt drags behind horizontal motion, with its own wobbly spring and a gentle sway
    const sway = Math.sin(state.clock.elapsedTime * 1.3) * 0.035;
    const tiltTarget = THREE.MathUtils.clamp(s.vx * 0.0009, -0.55, 0.55) + sway;
    s.vtilt += (60 * (tiltTarget - s.tilt) - 7 * s.vtilt) * dt;
    s.tilt += s.vtilt * dt;

    umbrellaState.open += ((active ? 1 : 0) - umbrellaState.open) * Math.min(1, dt * 8);
    umbrellaState.gx = s.x;
    umbrellaState.gy = s.y;
    umbrellaState.vx = s.vx;
    umbrellaState.tilt = s.tilt;

    // Rim centre on the z = 0 plane for the rain shader
    const k0 = worldPerPixel(size.height, 0);
    const [g0x, g0y] = pxToWorld(s.x, s.y, size.width, size.height, 0);
    const L = SHAFT * radiusPx * k0;
    umbrellaState.rimX = g0x - Math.sin(s.tilt) * L;
    umbrellaState.rimY = g0y + Math.cos(s.tilt) * L;
    umbrellaState.radius = radiusPx * k0 * umbrellaState.open;
    umbrellaState.height = canopy.height * radiusPx * k0;

    // Place the model on its own plane so it projects exactly under the cursor
    const kz = worldPerPixel(size.height, UMB_Z);
    const [wx, wy] = pxToWorld(s.x, s.y, size.width, size.height, UMB_Z);
    const o = outer.current;
    if (o) {
      const open = umbrellaState.open;
      o.visible = open > 0.01;
      o.position.set(wx, wy, UMB_Z);
      o.rotation.z = s.tilt;
      o.scale.setScalar(radiusPx * kz * (0.6 + 0.4 * open));
    }
    if (canopyRef.current) {
      const open = umbrellaState.open;
      canopyRef.current.scale.set(0.15 + 0.85 * open, 1 + (1 - open) * 1.4, 0.15 + 0.85 * open);
    }
    // R3F copies uniform values into the material, so update them through the material itself
    for (const m of [backMat.current, frontMat.current]) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uFlash.value = rainStore.flash;
      m.uniforms.uRain.value = rainStore.intensity;
    }

    // --- Splashes off the canopy ---
    const sp = splash;
    const rate = 110 * rainStore.intensity * umbrellaState.open;
    sp.spawnAcc += rate * dt;
    while (sp.spawnAcc >= 1) {
      sp.spawnAcc -= 1;
      const i = sp.cursor;
      sp.cursor = (sp.cursor + 1) % sp.n;
      const lx = (Math.random() * 2 - 1) * radiusPx * 0.95;
      const ly = SHAFT * radiusPx + canopy.height * radiusPx * (1 - (lx / radiusPx) ** 2);
      const ct = Math.cos(s.tilt);
      const st = Math.sin(s.tilt);
      sp.px[i * 2] = s.x + (lx * ct - ly * st);
      sp.px[i * 2 + 1] = s.y - (lx * st + ly * ct);
      sp.v[i * 2] = Math.sign(lx) * (30 + Math.random() * 110) + (Math.random() - 0.5) * 60;
      sp.v[i * 2 + 1] = -(70 + Math.random() * 130); // upward in px space
      sp.life[i] = 0.3 + Math.random() * 0.35;
    }
    const posAttr = sp.geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < sp.n; i++) {
      if (sp.life[i] <= 0) {
        arr[i * 3] = 9999;
        arr[i * 3 + 1] = 9999;
        arr[i * 3 + 2] = UMB_Z;
        continue;
      }
      sp.life[i] -= dt;
      sp.v[i * 2 + 1] += 900 * dt;
      sp.px[i * 2] += sp.v[i * 2] * dt;
      sp.px[i * 2 + 1] += sp.v[i * 2 + 1] * dt;
      const [x, y] = pxToWorld(sp.px[i * 2], sp.px[i * 2 + 1], size.width, size.height, UMB_Z + 0.1);
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = UMB_Z + 0.1;
    }
    posAttr.needsUpdate = true;
  });

  const top = SHAFT + canopy.height;
  // bamboo nodes along the shaft
  const nodes = [0.42, 0.78, 1.14, 1.5].filter((y) => y < top - 0.05);

  return (
    <>
      <group ref={outer}>
        {/* lean the canopy toward the camera so a bit of the top shows */}
        <group rotation={[0.3, 0, 0]}>
          {/* bamboo shaft */}
          <mesh position={[0, (top + 0.05) / 2 - 0.05, 0]}>
            <cylinderGeometry args={[0.024, 0.026, top + 0.05, 10]} />
            <meshStandardMaterial color="#d2b47c" roughness={0.55} />
          </mesh>
          {nodes.map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.031, 0.031, 0.022, 10]} />
              <meshStandardMaterial color="#a8854e" roughness={0.6} />
            </mesh>
          ))}
          {/* grip end */}
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.03, 0.028, 0.03, 10]} />
            <meshStandardMaterial color="#8f6d3d" roughness={0.6} />
          </mesh>
          {/* tip */}
          <mesh position={[0, top + 0.06, 0]}>
            <cylinderGeometry args={[0.012, 0.02, 0.12, 8]} />
            <meshStandardMaterial color="#f2f2f4" roughness={0.3} />
          </mesh>

          <group ref={canopyRef} position={[0, SHAFT, 0]}>
            {/* inside surface first, then the outside, so the clear vinyl blends in order */}
            <mesh geometry={canopy.geo} renderOrder={10}>
              <shaderMaterial
                ref={backMat}
                vertexShader={canopyVertex}
                fragmentShader={canopyFragment}
                uniforms={backUniforms}
                side={THREE.BackSide}
                transparent
                depthWrite={false}
              />
            </mesh>
            <mesh geometry={canopy.geo} renderOrder={11}>
              <shaderMaterial
                ref={frontMat}
                vertexShader={canopyVertex}
                fragmentShader={canopyFragment}
                uniforms={frontUniforms}
                side={THREE.FrontSide}
                transparent
                depthWrite={false}
              />
            </mesh>
          </group>
        </group>
      </group>

      <points geometry={splash.geo} frustumCulled={false} renderOrder={12}>
        <pointsMaterial
          color="#bcd2ef"
          size={2.4}
          sizeAttenuation={false}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </points>
    </>
  );
}
