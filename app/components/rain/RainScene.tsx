"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import City from "./City";
import Rain from "./Rain";
import Skyline from "./Skyline";
import Signal from "./Signal";
import Billboard from "./Billboard";
import WindowParticles from "./WindowParticles";
import Umbrella from "./Umbrella";
import Lightning from "./Lightning";
import PerfWatch from "./PerfWatch";
import { CAMERA_FOV, CAMERA_Z, getRainQuality, type RainQuality } from "./quality";

interface RainSceneProps {
  images: string[];
  onReveal: (index: number) => void;
  /** Called if the scene is still too slow on this device after dropping to the lowest resolution. */
  onSlow?: () => void;
}

/** Fixed full-screen canvas behind the page. Loaded with next/dynamic + ssr:false. */
export default function RainScene({ images, onReveal, onSlow }: RainSceneProps) {
  const [quality] = useState<RainQuality>(() => getRainQuality());
  const [hidden, setHidden] = useState(false);

  // Adaptive resolution: if the scene can't hold ~50fps (e.g. Firefox copying every WebGL frame back to the
  // CPU when its hardware acceleration is off), render fewer pixels; give up only if even that's too slow.
  const [dpr, setDpr] = useState(() => Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1.5));
  const dprRef = useRef(dpr);
  const handleSample = useCallback(
    (fps: number) => {
      if (fps >= 50) return;
      if (fps < 15) return onSlow?.(); // hopeless (software rendering): straight to the list
      if (dprRef.current > 0.76) {
        dprRef.current = Math.max(0.75, Math.round((dprRef.current - 0.25) * 100) / 100);
        setDpr(dprRef.current);
      } else if (fps < 20) {
        onSlow?.();
      }
    },
    [onSlow],
  );

  // Stop rendering entirely while the tab is in the background
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true" data-dpr={dpr}>
      <Canvas
        frameloop={hidden ? "never" : "always"}
        dpr={dpr}
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        onCreated={({ gl }) => gl.setClearColor("#03060d")}
      >
        <directionalLight position={[-4, 8, 10]} intensity={1.6} color="#dfe7ff" />
        <City />
        <Lightning />
        <Signal />
        <Skyline images={images} onReveal={onReveal} />
        <WindowParticles images={images} />
        <Billboard />
        <Rain count={quality.drops} />
        <Umbrella splashCount={quality.splashes} />
        {/* re-measure from scratch after each resolution change */}
        <PerfWatch key={dpr} onSample={handleSample} />
      </Canvas>
    </div>
  );
}
