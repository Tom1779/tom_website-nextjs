"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const WARMUP = 1.5; // s: ignore shader compiling / texture uploads right after mount
const WINDOW = 3; // s: then average the frame rate over this long
const MIN_FPS = 20;

/** Calls onSlow once if the scene can't keep up (e.g. weak or software-rendered graphics). */
export default function PerfWatch({ onSlow }: { onSlow: () => void }) {
  const s = useRef({ t: 0, frames: 0, done: false });
  useFrame((_, dt) => {
    const st = s.current;
    if (st.done) return;
    // a hidden tab pauses rendering; huge gaps aren't the scene's fault
    st.t += Math.min(dt, 0.25);
    if (st.t < WARMUP) return;
    st.frames++;
    if (st.t >= WARMUP + WINDOW) {
      st.done = true;
      if (st.frames / WINDOW < MIN_FPS) onSlow();
    }
  });
  return null;
}
