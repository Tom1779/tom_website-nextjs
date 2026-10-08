// Mutable state shared between the DOM layer (RainProjects) and the R3F scene.
// Kept outside React so the render loop can read/write it every frame without re-renders.
import type { CityLayout } from "./layout";

export const MAX_PROJECTS = 16;

export const rainStore = {
  pointer: {
    x: 0, // client px
    y: 0,
    // Document-space y used when the umbrella is planted (touch), so it scrolls with the page
    docY: 0,
    inside: false, // pointer is over the city
    planted: false, // touch devices: umbrella stays where it was tapped
    seen: false, // pointer has moved at least once
    // index of the revealed (clickable) project the mouse is over, or -1
    overLink: -1,
  },
  // The city container and the layout both the DOM and the shader draw from
  cityEl: null as HTMLElement | null,
  // the signal projected into the sky by the searchlight (a button that opens the profile card)
  signalCardEl: null as HTMLElement | null,
  signalHover: false,
  // the résumé billboard, painted by the DOM and shown in the scene (so the rain falls in front of it)
  billboardCanvas: null as HTMLCanvasElement | null,
  billboardVersion: 0,
  billboardHover: false,
  layout: null as CityLayout | null,
  dryness: new Float32Array(MAX_PROJECTS),
  // eased dryness actually shown on screen (shared by the window shader and its pixel cloud)
  shown: new Float32Array(MAX_PROJECTS),
  // Windows that have fully dried stay revealed
  revealed: new Uint8Array(MAX_PROJECTS),
  // Click-to-dry boost per window (decays)
  boost: new Float32Array(MAX_PROJECTS),
  // Which project window the umbrella is currently sheltering (-1 for none)
  sheltered: -1,
  // 0..1 lightning flash brightness for this frame
  flash: 0,
  flashRequested: false,
  revealAllRequested: false,
  refogRequested: false,
  // 0..1 rain heaviness, driven by scroll progress
  intensity: 0.5,
  // client-px y where the distant skyline should sit (NaN when not laid out yet)
  roofY: NaN,
  // document-px y of the pool's far edge at the bottom of the city (NaN when not laid out yet)
  streetTop: NaN,
};

export type RainStore = typeof rainStore;
