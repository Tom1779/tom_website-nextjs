// Deterministic city layout shared by the DOM (link hit-areas, labels) and the shader (buildings),
// so both draw from the exact same numbers. All values are px relative to the city container.

export const MAX_BUILDINGS = 8;
export const MAX_PROJECT_WINDOWS = 16;

export interface Building {
  x: number;
  top: number;
  w: number;
  depth: number; // 0 = nearest .. 1 = farthest (hazier)
  cols: number;
  rows: number;
}

export interface ProjectWindow {
  project: number;
  building: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityLayout {
  width: number;
  height: number;
  skyTop: number; // px reserved for the header; buildings rise from just below it
  win: { w: number; h: number };
  gap: { x: number; y: number };
  pad: { x: number; top: number };
  buildings: Building[]; // sorted far -> near (draw order)
  windows: ProjectWindow[]; // index = project index
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STREET_FADE = 130; // bottom px of ordinary ground floors (projects stay above them)
export const GROUND_H = 34; // wet sidewalk + curb the buildings stand on, at the bottom of the city
export const POOL_H = 220; // px of pool under the city before the water spills over the sides

/** Height of the city container: at least the first screen, tall enough for two storeys of big windows. */
export function cityHeight(vw: number, vh: number, skyTop: number) {
  const need = skyTop + (vw < 640 ? 640 : 520);
  return Math.round(Math.min(Math.max(vh - 64, need), 1200));
}

/**
 * @param skyTop px reserved at the top for the header (the sky); buildings rise from just below it
 */
export function computeCityLayout(width: number, height: number, count: number, skyTop = 0): CityLayout {
  const rand = mulberry32(20251006);
  const small = width < 640;
  const medium = width < 1100;

  // close enough to see the frost, drips and the project inside each window
  const win = small ? { w: 52, h: 68 } : medium ? { w: 70, h: 90 } : { w: 84, h: 108 };
  const gap = { x: Math.round(win.w * 0.36), y: Math.round(win.h * 0.4) };
  const pad = { x: Math.round(win.w * 0.42), top: Math.round(win.h * 0.55) };
  const stepX = win.w + gap.x;
  const stepY = win.h + gap.y;

  // a few big foreground buildings; the shader fills in a hazier mid-ground row behind them
  const nb = Math.min(MAX_BUILDINGS, small ? 2 : 3);
  const cap = Math.ceil(count / nb);
  const slot = width / nb;
  const fade = STREET_FADE; // keep projects above the ground floors

  const buildings: Building[] = [];
  for (let i = 0; i < nb; i++) {
    const target = slot * (0.8 + rand() * 0.15);
    const cols = Math.max(2, Math.floor((target - pad.x * 2 + gap.x) / stepX));
    const w = cols * stepX - gap.x + pad.x * 2;
    const jitter = (slot - w) * (rand() - 0.5) * 0.8;
    const x = Math.round(i * slot + (slot - w) / 2 + jitter);
    const top = Math.round(skyTop + rand() * (height - skyTop) * 0.1);
    const rows = Math.max(3, Math.floor((height - top - pad.top) / stepY));
    buildings.push({ x, top, w, depth: rand() * 0.4, cols, rows });
  }

  // Spread projects: one per building, extras go to the widest buildings (evenly capped)
  const perBuilding = new Array(nb).fill(0);
  for (let p = 0; p < count; p++) {
    if (p < nb) {
      perBuilding[p % nb]++;
    } else {
      const order = [...buildings.keys()].sort((a, b) => buildings[b].w - buildings[a].w);
      const target = order.find((b) => perBuilding[b] < cap) ?? order[0];
      perBuilding[target]++;
    }
  }

  // Interleave project order across the skyline so neighbours aren't consecutive projects
  const windows: ProjectWindow[] = [];
  const slotsFor: { building: number; x: number; y: number }[] = [];
  buildings.forEach((b, bi) => {
    const lastRow = Math.max(0, Math.floor((height - fade - b.top - pad.top - win.h) / stepY));
    const used: [number, number][] = [];
    // every window above the street haze, in a seeded random order
    const cells: [number, number][] = [];
    for (let row = 0; row <= lastRow; row++) for (let col = 0; col < b.cols; col++) cells.push([row, col]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (let k = 0; k < perBuilding[bi]; k++) {
      const free = cells.filter(([r, c]) => !used.some(([ur, uc]) => ur === r && uc === c));
      // prefer windows that aren't right next to another project; never reuse one
      const pick =
        free.find(([r, c]) => used.every(([ur, uc]) => Math.abs(ur - r) >= 2 || Math.abs(uc - c) >= 2)) ?? free[0];
      if (!pick) break;
      const [row, col] = pick;
      used.push([row, col]);
      slotsFor.push({ building: bi, x: b.x + pad.x + col * stepX, y: b.top + pad.top + row * stepY });
    }
  });
  slotsFor.sort((a, b) => a.x - b.x);
  slotsFor.slice(0, count).forEach((s, project) => {
    windows.push({ project, building: s.building, x: s.x, y: s.y, w: win.w, h: win.h });
  });

  // Draw far buildings first; ties keep left-to-right order
  const order = buildings.map((b, i) => ({ b, i })).sort((a, b) => b.b.depth - a.b.depth);
  const remap = new Map(order.map((o, ni) => [o.i, ni]));
  return {
    width,
    height,
    skyTop,
    win,
    gap,
    pad,
    buildings: order.map((o) => o.b),
    windows: windows.map((w) => ({ ...w, building: remap.get(w.building)! })),
  };
}
