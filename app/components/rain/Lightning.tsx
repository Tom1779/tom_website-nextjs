"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { worldPerPixel } from "./quality";

const BOLT_Z = -34;

/** Jagged bolt via midpoint displacement, plus a couple of branches, as one ribbon geometry. */
function buildBolt(viewW: number, viewH: number) {
  const startX = (Math.random() - 0.5) * viewW * 0.8;
  const top = viewH * 0.55;
  const bottom = -viewH * Math.random() * 0.08; // end around the skyline

  const displace = (a: THREE.Vector2, b: THREE.Vector2, rough: number, depth: number): THREE.Vector2[] => {
    if (depth === 0) return [a, b];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.x += (Math.random() - 0.5) * rough;
    const left = displace(a, mid, rough * 0.55, depth - 1);
    const right = displace(mid, b, rough * 0.55, depth - 1);
    return [...left.slice(0, -1), ...right];
  };

  const strands: { pts: THREE.Vector2[]; width: number }[] = [];
  const main = displace(
    new THREE.Vector2(startX, top),
    new THREE.Vector2(startX + (Math.random() - 0.5) * viewW * 0.2, bottom),
    viewW * 0.12,
    6,
  );
  const unit = viewW / 900;
  strands.push({ pts: main, width: 3.2 * unit });
  for (let b = 0; b < 3; b++) {
    const from = main[Math.floor(main.length * (0.2 + Math.random() * 0.5))];
    const len = viewH * (0.12 + Math.random() * 0.2);
    const dir = Math.random() < 0.5 ? -1 : 1;
    strands.push({
      pts: displace(from.clone(), new THREE.Vector2(from.x + dir * len * 0.6, from.y - len), viewW * 0.05, 4),
      width: 1.5 * unit,
    });
  }

  const positions: number[] = [];
  const indices: number[] = [];
  for (const s of strands) {
    const base = positions.length / 3;
    s.pts.forEach((p, i) => {
      const taper = 1 - (i / s.pts.length) * 0.6;
      positions.push(p.x - s.width * taper, p.y, 0, p.x + s.width * taper, p.y, 0);
      if (i > 0) {
        const a = base + (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

export default function Lightning() {
  const size = useThree((s) => s.size);
  const boltRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const strike = useRef({ next: 6 + Math.random() * 6, start: -100, second: 0.15 });
  const geoRef = useRef<THREE.BufferGeometry | null>(null);

  const placeholder = useMemo(() => new THREE.BufferGeometry(), []);
  useEffect(
    () => () => {
      placeholder.dispose();
      geoRef.current?.dispose();
    },
    [placeholder],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = strike.current;

    const trigger = () => {
      s.start = t;
      s.second = 0.1 + Math.random() * 0.15;
      s.next = t + 9 + Math.random() * 10;
      const k = worldPerPixel(size.height, BOLT_Z);
      geoRef.current?.dispose();
      geoRef.current = buildBolt(size.width * k, size.height * k);
      if (boltRef.current) boltRef.current.geometry = geoRef.current;
    };

    if (rainStore.flashRequested) {
      rainStore.flashRequested = false;
      trigger();
    } else if (t > s.next) {
      trigger();
    }

    // double-strike envelope
    const e = t - s.start;
    let f = 0;
    if (e >= 0) {
      f += Math.exp(-e * 18) * (e < 0.02 ? e / 0.02 : 1);
      const e2 = e - s.second;
      if (e2 >= 0) f += 0.8 * Math.exp(-e2 * 6);
    }
    f = Math.min(1, f);
    rainStore.flash = f;

    if (matRef.current) matRef.current.opacity = Math.min(1, f * 1.6);
    if (boltRef.current) boltRef.current.visible = f > 0.02;
    if (ambient.current) ambient.current.intensity = 0.55 + f * 2.5;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.55} color="#9fb3d9" />
      <mesh ref={boltRef} geometry={placeholder} position={[0, 0, BOLT_Z]} renderOrder={-5} visible={false}>
        <meshBasicMaterial
          ref={matRef}
          color="#e3ecff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
