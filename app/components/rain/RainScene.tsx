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
  /** Render hidden and measure the frame rate once (first visit), reporting it via onProbe. */
  probing?: boolean;
  onProbe?: (fps: number) => void;
}

/** Fixed full-screen canvas behind the page. Loaded with next/dynamic + ssr:false. */
export default function RainScene({ images, onReveal, probing = false, onProbe }: RainSceneProps) {
  const [quality] = useState<RainQuality>(() => getRainQuality());
  const [hidden, setHidden] = useState(false);
  const reported = useRef(false);
  const handleSample = useCallback(
    (fps: number) => {
      if (reported.current) return;
      reported.current = true;
      onProbe?.(fps);
    },
    [onProbe],
  );

  // Stop rendering entirely while the tab is in the background
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    // While probing, the scene renders (and is composited, so the measurement includes that cost) but is
    // practically invisible; it fades in once it's known to run well
    <div
      className="fixed inset-0 -z-10 pointer-events-none transition-opacity duration-700"
      style={{ opacity: probing ? 0.001 : 1 }}
      aria-hidden="true"
      data-probing={probing ? "" : undefined}
    >
      <Canvas
        frameloop={hidden ? "never" : "always"}
        dpr={[1, 1.5]}
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
        {probing && <PerfWatch onSample={handleSample} />}
      </Canvas>
    </div>
  );
}
