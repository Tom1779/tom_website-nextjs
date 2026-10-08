"use client";

import { useEffect, useState } from "react";
import { getGpu, type GpuCapability } from "./rain/gpu";

/**
 * The visitor's WebGL capability, known after mount (null during SSR / the first render).
 * "software" means hardware acceleration is off: expensive CSS effects should be skipped.
 */
export function useGpu(): GpuCapability | null {
  const [gpu, setGpu] = useState<GpuCapability | null>(null);
  useEffect(() => setGpu(getGpu()), []);
  return gpu;
}
