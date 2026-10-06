"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { pxToWorld, worldPerPixel } from "./quality";

const UMB_Z = 3;
const RIBS = 8;

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

function buildCanopy() {
  const height = 0.42;
  const geo = new THREE.ConeGeometry(1, height, RIBS * 2, 1, true);
  // Scallop the rim: vertices between ribs sag inward and up
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const step = (Math.PI * 2) / (RIBS * 2);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (Math.abs(y + height / 2) > 1e-4) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const idx = Math.round(a / step);
    if (Math.abs(idx) % 2 === 1) {
      pos.setXYZ(i, x * 0.9, y + 0.07, z * 0.9);
    }
  }
  const flat = geo.toNonIndexed();
  geo.dispose();

  // Alternate panel colours by angle
  const p = flat.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const a = new THREE.Color("#c0283a");
  const b = new THREE.Color("#7e1424");
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const ang = Math.atan2(cz, cx) + Math.PI;
    const seg = Math.floor((ang / (Math.PI * 2)) * RIBS) % 2;
    const c = seg === 0 ? a : b;
    for (let v = 0; v < 3; v++) {
      colors[(t + v) * 3] = c.r;
      colors[(t + v) * 3 + 1] = c.g;
      colors[(t + v) * 3 + 2] = c.b;
    }
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  return { geo: flat, height };
}

// Shaft length from grip to canopy rim, in canopy radii
const SHAFT = 1.05;

export default function Umbrella({ splashCount }: { splashCount: number }) {
  const size = useThree((s) => s.size);
  const outer = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Group>(null);
  const sim = useRef({ x: -9999, y: -9999, vx: 0, vy: 0, tilt: 0, vtilt: 0, init: false });

  const canopy = useMemo(buildCanopy, []);
  useEffect(() => () => canopy.geo.dispose(), [canopy]);

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

    const active = ptr.planted || (ptr.inside && ptr.seen);
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
      canopyRef.current.scale.set(0.2 + 0.8 * open, 1 + (1 - open) * 1.6, 0.2 + 0.8 * open);
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
      const ly = SHAFT * radiusPx + canopy.height * radiusPx * (1 - Math.abs(lx) / radiusPx);
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

  const shaftLen = SHAFT + canopy.height;

  return (
    <>
      <group ref={outer} renderOrder={10}>
        {/* lean the canopy toward the camera so a bit of the top shows */}
        <group rotation={[0.38, 0, 0]}>
          <group ref={canopyRef} position={[0, SHAFT + canopy.height / 2, 0]}>
            <mesh geometry={canopy.geo}>
              <meshStandardMaterial
                vertexColors
                flatShading
                roughness={0.45}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
          {/* shaft */}
          <mesh position={[0, shaftLen / 2, 0]}>
            <cylinderGeometry args={[0.022, 0.022, shaftLen, 8]} />
            <meshStandardMaterial color="#c9c9cf" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* tip */}
          <mesh position={[0, shaftLen + 0.07, 0]}>
            <cylinderGeometry args={[0.012, 0.03, 0.14, 8]} />
            <meshStandardMaterial color="#d8d8de" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* J handle */}
          <mesh position={[-0.13, 0, 0]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.13, 0.035, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#5a3a26" roughness={0.6} />
          </mesh>
        </group>
      </group>

      <points geometry={splash.geo} frustumCulled={false} renderOrder={11}>
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
