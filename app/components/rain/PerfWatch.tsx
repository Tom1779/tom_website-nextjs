"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const SETTLE_FRAMES = 12; // consecutive quick frames before measuring (shader compiles stall the first ones)
const QUICK = 0.1; // s: a frame this fast counts towards settling
const WINDOW = 1200; // ms of real time to average the frame rate over

/**
 * Reports the scene's average frame rate once, as soon as it has settled after mount (used for the hidden
 * first-visit test).
 */
export default function PerfWatch({ onSample }: { onSample: (fps: number) => void }) {
  const s = useRef({ settled: 0, start: 0, frames: 0, done: false });
  useFrame((_, dt) => {
    const st = s.current;
    if (st.done) return;
    if (!st.start) {
      st.settled = dt < QUICK ? st.settled + 1 : 0;
      if (st.settled >= SETTLE_FRAMES) st.start = performance.now();
      return;
    }
    st.frames++;
    const elapsed = performance.now() - st.start;
    if (elapsed >= WINDOW) {
      st.done = true;
      onSample((st.frames * 1000) / elapsed);
    }
  });
  return null;
}
