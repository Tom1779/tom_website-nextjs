"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const WARMUP = 1.5; // s: ignore shader compiling / texture uploads / resizes right after (re)mount
const WINDOW = 2; // s: average the frame rate over windows this long
const MAX_WINDOWS = 3;

/**
 * Reports the scene's average frame rate a few times after mount (remount it, e.g. with a new key, to
 * measure again after changing quality).
 */
export default function PerfWatch({ onSample }: { onSample: (fps: number) => void }) {
  const s = useRef({ t: 0, start: WARMUP, frames: 0, windows: 0 });
  useFrame((_, dt) => {
    const st = s.current;
    if (st.windows >= MAX_WINDOWS) return;
    // a hidden tab pauses rendering; huge gaps aren't the scene's fault
    st.t += Math.min(dt, 0.25);
    if (st.t < st.start) return;
    st.frames++;
    if (st.t >= st.start + WINDOW) {
      onSample(st.frames / WINDOW);
      st.windows++;
      st.start = st.t;
      st.frames = 0;
    }
  });
  return null;
}
