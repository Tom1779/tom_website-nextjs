"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import City from "./City";
import Rain from "./Rain";
import Skyline from "./Skyline";
import Street from "./Street";
import Umbrella from "./Umbrella";
import Lightning from "./Lightning";
import { CAMERA_FOV, CAMERA_Z, getRainQuality, type RainQuality } from "./quality";

interface RainSceneProps {
  images: string[];
  onReveal: (index: number) => void;
}

/** Fixed full-screen canvas behind the page. Loaded with next/dynamic + ssr:false. */
export default function RainScene({ images, onReveal }: RainSceneProps) {
  const [quality] = useState<RainQuality>(() => getRainQuality());
  const [hidden, setHidden] = useState(false);

  // Stop rendering entirely while the tab is in the background
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
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
        <Street />
        <Skyline images={images} onReveal={onReveal} />
        <Rain count={quality.drops} />
        <Umbrella splashCount={quality.splashes} />
      </Canvas>
    </div>
  );
}
