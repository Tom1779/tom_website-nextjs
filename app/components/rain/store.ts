// Mutable state shared between the DOM layer (RainProjects) and the R3F scene.
// Kept outside React so the render loop can read/write it every frame without re-renders.

export const MAX_PANELS = 32;

export const rainStore = {
  pointer: {
    x: 0, // client px
    y: 0,
    // Document-space y used when the umbrella is planted (touch), so it scrolls with the page
    docY: 0,
    inside: false, // pointer is over the projects section
    planted: false, // touch devices: umbrella stays where it was tapped
    seen: false, // pointer has moved at least once
  },
  sectionEl: null as HTMLElement | null,
  panelEls: [] as (HTMLElement | null)[],
  dryness: new Float32Array(MAX_PANELS),
  // Panels that have fully dried stay revealed
  revealed: new Uint8Array(MAX_PANELS),
  // Click-to-dry boost per panel (decays)
  boost: new Float32Array(MAX_PANELS),
  // Which panel the umbrella is currently sheltering (-1 for none)
  sheltered: -1,
  // 0..1 lightning flash brightness for this frame
  flash: 0,
  flashRequested: false,
  revealAllRequested: false,
  refogRequested: false,
  // 0..1 rain heaviness, driven by scroll progress
  intensity: 0.5,
};

export type RainStore = typeof rainStore;
