"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { BILLBOARD_LAMP, BILLBOARD_PAD } from "./layout";
import { pxToWorld, worldPerPixel } from "./quality";

/**
 * Shows the résumé billboard (painted by ResumeBillboard) as a plane in the city, drawn after the buildings
 * and before the rain so the rain falls in front of it.
 */
export default function Billboard() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useRef<{ t: THREE.CanvasTexture; v: number } | null>(null);
  const hover = useRef(0);
  const size = useThree((s) => s.size);

  useEffect(() => () => tex.current?.t.dispose(), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    const mt = mat.current;
    const L = rainStore.layout;
    const el = rainStore.cityEl;
    const canvas = rainStore.billboardCanvas;
    const b = L?.billboard;
    if (!m || !mt || !L || !el || !canvas || !b) {
      if (m) m.visible = false;
      return;
    }
    if (!tex.current || tex.current.v !== rainStore.billboardVersion) {
      tex.current?.t.dispose();
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      tex.current = { t, v: rainStore.billboardVersion };
      mt.map = t;
      mt.needsUpdate = true;
    }

    // the plane covers the sign plus the glow margin and the lamps above it
    const r = el.getBoundingClientRect();
    const x = r.left + b.x - BILLBOARD_PAD;
    const y = r.top + b.y - BILLBOARD_PAD - BILLBOARD_LAMP;
    const w = b.w + BILLBOARD_PAD * 2;
    const h = b.h + BILLBOARD_PAD * 2 + BILLBOARD_LAMP;
    m.visible = y + h > 0 && y < size.height;
    if (!m.visible) return;
    const k = worldPerPixel(size.height, 0);
    const [cx, cy] = pxToWorld(x + w / 2, y + h / 2, size.width, size.height, 0);
    m.position.set(cx, cy, 0.01);
    m.scale.set(w * k, h * k, 1);

    // brighten a little on hover / focus, and with lightning
    hover.current += ((rainStore.billboardHover ? 1 : 0) - hover.current) * Math.min(1, dt * 10);
    const lum = 1 + hover.current * 0.18 + rainStore.flash * 0.3;
    mt.color.setRGB(lum, lum, lum);
  });

  return (
    <mesh ref={mesh} renderOrder={0.8} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
