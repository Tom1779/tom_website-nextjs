// Screen-size tuning, following the same breakpoints as the original ChromaGrid config in page.tsx.

export interface RainQuality {
  drops: number; // rain streak instances
  splashes: number;
}

export function getRainQuality(): RainQuality {
  if (typeof window === "undefined") {
    return { drops: 2500, splashes: 200 };
  }
  const w = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  if (w < 768 || coarse) {
    return { drops: 1200, splashes: 120 };
  }
  if (w > 2560 || dpr > 2) {
    return { drops: 2200, splashes: 160 };
  }
  if (w > 1920) {
    return { drops: 3000, splashes: 220 };
  }
  if (w > 1200) {
    return { drops: 3200, splashes: 240 };
  }
  return { drops: 2400, splashes: 200 };
}

// Camera setup shared by the scene and the px <-> world helpers
export const CAMERA_Z = 20;
export const CAMERA_FOV = 35;

/** World units per CSS pixel on a plane at depth `z` (camera looks down -Z from CAMERA_Z). */
export function worldPerPixel(viewportHeightPx: number, z = 0) {
  const visibleH = 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * (CAMERA_Z - z);
  return visibleH / viewportHeightPx;
}

/** Convert client pixel coordinates to world coordinates on the plane at depth `z`. */
export function pxToWorld(px: number, py: number, width: number, height: number, z = 0): [number, number] {
  const k = worldPerPixel(height, z);
  return [(px - width / 2) * k, -(py - height / 2) * k];
}
