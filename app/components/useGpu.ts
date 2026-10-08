"use client";

import { useEffect, useState } from "react";
import { getGpu, type GpuCapability } from "./rain/gpu";

/**
 * The visitor's WebGL capability, known after mount (null during SSR / the first render).
 * Anything but "ok" (off, unknown, or no WebGL) means expensive CSS effects should be skipped.
 */
export function useGpu(): GpuCapability | null {
  const [gpu, setGpu] = useState<GpuCapability | null>(null);
  useEffect(() => setGpu(getGpu()), []);
  return gpu;
}
