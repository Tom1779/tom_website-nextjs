"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore, MAX_PROJECTS } from "./store";
import { MAX_BUILDINGS, STREET_FADE } from "./layout";
import { pxToWorld, worldPerPixel } from "./quality";
import { umbrellaState, SHAFT } from "./Umbrella";

const DRY_SECONDS = 1.0; // time under the umbrella to fully dry a window
const REFOG_SECONDS = 6.0; // a partly-dried window fogs back up this slowly
const TILE = 256; // atlas tile size per project image
const BG = [11, 18, 32]; // backdrop behind each project image

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Draws the mid-ground row and every foreground building with its windows in container px, the same
// space the DOM uses, so the project windows line up with their link hit-areas exactly.
const fragmentShader = /* glsl */ `
  #define MAXB ${MAX_BUILDINGS}
  #define MAXP ${MAX_PROJECTS}
  uniform vec2 uSize;
  uniform float uSkyTop;
  uniform vec2 uWin;
  uniform vec2 uGap;
  uniform vec2 uPad;
  uniform vec4 uBld[MAXB];   // x, top, width, depth
  uniform int uBldN;
  uniform vec4 uProj[MAXP];  // x, y, w, h
  uniform vec4 uProjS[MAXP]; // dryness, glow, revealed, atlas tile
  uniform int uProjN;
  uniform sampler2D uAtlas;
  uniform float uTiles;
  uniform float uAtlasReady;
  uniform float uTime;
  uniform float uFlash;
  uniform float uPass;      // 0: buildings + rooms, 1: project-window glass (drawn over the pixel clouds)
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  float box(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }

  // one palette for every layer so the foreground melts into the distant skyline
  const vec3 FRAME = vec3(0.03, 0.035, 0.05);
  const vec3 HAZE = vec3(0.065, 0.08, 0.115);
  const vec3 AMBER = vec3(1.0, 0.68, 0.32);

  // ---- mid-ground: a row of hazier, smaller-windowed buildings behind the foreground ----
  vec4 midLayer(vec2 p) {
    float colW = uWin.x * 2.8;
    float sx = p.x + 41.0;
    float id = floor(sx / colW);
    float lx = sx - id * colW;
    if (hash(vec2(id, 3.1)) < 0.14) return vec4(0.0); // a gap where the far skyline shows
    float inset = 3.0 + colW * 0.12 * step(0.55, hash(vec2(id, 5.0)));
    if (lx < inset || lx > colW - inset) return vec4(0.0);
    float top = uSkyTop + 20.0 + hash(vec2(id, 7.0)) * (uSize.y - uSkyTop) * 0.22;
    if (p.y < top) return vec4(0.0);

    vec3 col = vec3(0.04, 0.052, 0.078) * mix(0.85, 1.15, hash(vec2(id, 9.0)));
    vec2 mw = uWin * 0.3;
    vec2 st = mw + mw * vec2(0.55, 0.6);
    vec2 q = vec2(lx - inset - mw.x * 0.5, p.y - top - mw.y * 0.6);
    vec2 c = floor(q / st);
    vec2 wp = q - c * st;
    float inW = step(0.0, q.x) * step(0.0, q.y) * step(wp.x, mw.x) * step(wp.y, mw.y) * step(q.x + mw.x * 1.4, colW - 2.0 * inset);
    float lit = step(0.78, hash(c + id * 13.7));
    vec3 wc = lit > 0.5 ? mix(AMBER, vec3(1.0, 0.85, 0.6), hash(c + id)) * 0.38 : vec3(0.03, 0.038, 0.056);
    col = mix(col, wc, inW);
    // haze thickens toward the street
    col = mix(col, HAZE, 0.5 + 0.3 * smoothstep(top, uSize.y, p.y));
    col += vec3(0.25, 0.28, 0.4) * uFlash * 0.3;
    return vec4(col, 1.0);
  }

  // An ordinary apartment window: lit, TV-lit or dark, with a balcony rail
  vec3 apartment(vec2 wp, vec2 id) {
    vec2 u = wp / uWin;
    float h = hash(id);
    vec3 col;
    if (h > 0.64) {
      vec3 lc = mix(AMBER, vec3(1.0, 0.86, 0.62), hash(id + 3.0)) * mix(0.5, 0.95, hash(id + 4.0));
      col = lc * (0.6 + 0.4 * (1.0 - u.y));
      if (hash(id + 8.0) > 0.7) col *= 0.7 + 0.3 * step(0.45, fract(u.y * 9.0)); // blinds
      if (hash(id + 9.0) > 0.65) col = mix(col, vec3(0.3, 0.09, 0.06), smoothstep(0.22, 0.17, u.x)); // curtain
      // someone's silhouette now and then
      if (hash(id + 21.0) > 0.85) {
        float x = mix(0.35, 0.7, hash(id + 22.0));
        float body = box(u, vec2(x - 0.07, 0.42), vec2(x + 0.07, 1.0));
        float head = 1.0 - smoothstep(0.065, 0.08, length((u - vec2(x, 0.34)) * vec2(1.0, uWin.y / uWin.x)));
        col = mix(col, vec3(0.04, 0.03, 0.03), max(body, head));
      }
    } else if (h > 0.6) {
      float flick = 0.6 + 0.4 * sin(uTime * 7.0 + h * 50.0) * sin(uTime * 3.1 + h * 20.0);
      col = vec3(0.12, 0.2, 0.42) * flick;
    } else {
      col = vec3(0.02, 0.026, 0.04) + vec3(0.025, 0.03, 0.045) * (1.0 - u.y);
      col += vec3(0.045, 0.055, 0.075) * smoothstep(0.05, 0.0, abs(u.x - u.y * 0.5 - 0.2));
    }
    // balcony glass + rail
    float glassB = step(0.68, u.y);
    col = mix(col, col * 0.65 + vec3(0.012, 0.016, 0.026), glassB * 0.5);
    col = mix(col, FRAME * 2.2, 1.0 - step(1.2, abs(wp.y - uWin.y * 0.68)));
    // frame + mullion
    float edge = min(min(wp.x, uWin.x - wp.x), min(wp.y, uWin.y - wp.y));
    float mull = (1.0 - step(1.0, abs(wp.x - uWin.x * 0.6))) * (1.0 - glassB);
    return mix(col, FRAME, max(1.0 - step(2.0, edge), mull));
  }

  // Water tanks and antennas (with a blinking light) on top of the foreground buildings
  vec4 roofProps(vec2 p, vec4 b) {
    float seed = hash(vec2(b.x, b.z));
    vec4 o = vec4(0.0);
    vec3 dark = vec3(0.07, 0.085, 0.12); // same tone as the buildings so props read against the sky
    if (hash(vec2(seed, 1.0)) > 0.4) {
      float tw = uWin.x * 0.6;
      float th = uWin.y * 0.38;
      float tx = b.x + b.z * mix(0.25, 0.7, hash(vec2(seed, 2.0)));
      float base = b.y - 8.0;
      float body = box(p, vec2(tx, base - th), vec2(tx + tw, base));
      float roof = step(base - th - tw * 0.3, p.y) * step(p.y, base - th) * step(abs(p.x - tx - tw * 0.5), (p.y - (base - th - tw * 0.3)) / 0.6);
      float legs = step(base, p.y) * step(p.y, b.y) * (box(p, vec2(tx + 2.0, base), vec2(tx + 4.0, b.y)) + box(p, vec2(tx + tw - 4.0, base), vec2(tx + tw - 2.0, b.y)));
      float m = clamp(body + roof + legs, 0.0, 1.0);
      vec3 c = dark * (1.0 + 0.6 * (1.0 - step(2.0, p.x - tx))); // lit left edge
      c *= 0.9 + 0.2 * step(0.5, fract((p.x - tx) / 5.0)); // slats
      o = mix(o, vec4(c, 1.0), m);
    }
    if (hash(vec2(seed, 3.0)) > 0.35) {
      float ax = b.x + b.z * mix(0.12, 0.88, hash(vec2(seed, 4.0)));
      float ah = uWin.y * mix(0.6, 1.1, hash(vec2(seed, 5.0)));
      float mast = step(abs(p.x - ax), 0.9) * step(b.y - ah, p.y) * step(p.y, b.y);
      o = mix(o, vec4(dark * 1.4, 1.0), mast);
      float blink = step(0.55, sin(uTime * 2.2 + seed * 40.0));
      float dist = length(p - vec2(ax, b.y - ah));
      float light = (1.0 - smoothstep(2.0, 3.0, dist)) + exp(-dist / 5.0) * 0.6;
      o.rgb += vec3(1.0, 0.15, 0.1) * light * blink;
      o.a = max(o.a, min(1.0, light * blink));
    }
    return o;
  }

  // premultiplied "over" compositing for the glass layer
  vec4 over(vec4 dst, vec3 c, float a) { return vec4(c * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a)); }

  // One layer of water beads on the glass. Returns coverage; n is the offset from the bead centre in radii.
  float beads(vec2 d, float cell, float prob, vec2 rr, float seed, float shrink, out vec2 n) {
    vec2 g = d / cell;
    vec2 id = floor(g);
    vec2 f = (fract(g) - 0.5) * cell;
    float h = hash(id + seed);
    vec2 c = (vec2(hash(id + seed + 1.3), hash(id + seed + 2.7)) - 0.5) * cell * 0.45;
    float r = mix(rr.x, rr.y, hash(id + seed + 4.1)) * shrink;
    vec2 v = f - c;
    v.y *= 0.86; // beads sag a little under gravity
    n = v / max(r, 0.001);
    return step(1.0 - prob, h) * (1.0 - smoothstep(r - 0.7, r + 0.5, length(v)));
  }

  // A water drop over the frost: clears the fog inside, dark refracting rim, warm caustic underneath,
  // and a bright highlight up and to the left
  vec4 dropShade(vec4 P, float m, vec2 n) {
    if (m <= 0.001) return P;
    float len = length(n);
    P *= 1.0 - m * 0.78; // the drop clears most of the fog...
    P = over(P, vec3(0.45, 0.55, 0.7), m * 0.3); // ...and tints what's behind with cool water
    P = over(P, vec3(0.04, 0.055, 0.08), smoothstep(0.62, 1.0, len) * m * 0.8); // thin dark rim
    P = over(P, vec3(1.0, 0.95, 0.88), smoothstep(0.55, 0.9, len) * smoothstep(0.2, 0.8, n.y) * m * 0.35); // light through the bottom
    P = over(P, vec3(1.0), (1.0 - smoothstep(0.0, 0.26, length(n - vec2(-0.3, -0.38)))) * m); // sharp highlight
    P = over(P, vec3(1.0), (1.0 - smoothstep(0.0, 0.12, length(n - vec2(0.3, 0.42)))) * m * 0.5); // small back-glint
    return P;
  }

  // What's behind a project window: a warm room, and the project's image once it's dry
  vec3 windowInner(vec2 PD, vec4 PR, vec4 PS) {
    vec2 u = PD / PR.zw;
    vec3 room = vec3(1.0, 0.8, 0.52) * (0.7 + 0.3 * (1.0 - u.y));
    vec3 poster = vec3(${BG.map((c) => (c / 255).toFixed(4)).join(", ")});
    vec2 tuv = vec2(u.x, (PD.y - (PR.w - PR.z) * 0.5) / PR.z);
    if (uAtlasReady > 0.5 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      poster = texture2D(uAtlas, vec2((PS.w + clamp(tuv.x, 0.002, 0.998)) / uTiles, 1.0 - tuv.y)).rgb;
    }
    return mix(room, poster, max(smoothstep(0.86, 1.0, PS.x), uFlash * 0.85));
  }

  // The glass of a project window (drawn over the pixel cloud): frost, drips, beads, rail and frame
  vec4 windowGlass(vec2 PD, vec4 PR, vec4 PS, float fj) {
    vec2 u = PD / PR.zw;
    float dry = PS.x;
    float wet = 1.0 - dry;
    float s = PR.z / 84.0; // drops scale with the window

    // frost: heavier toward the bottom, clears in patches as it dries
    float f = fbm(u * vec2(2.4, 3.1) + fj * 3.7 + vec2(0.0, uTime * 0.03));
    float evap = clamp((fbm(u * 1.8 - fj) - (dry * 1.35 - 0.2)) / 0.18, 0.0, 1.0);
    float fogA = clamp(mix(0.62, 0.86, f) + 0.12 * smoothstep(0.5, 1.0, u.y) + (vnoise(PD * 0.6) - 0.5) * 0.08, 0.0, 1.0);
    fogA *= evap * (1.0 - uFlash * 0.75);
    vec3 frost = vec3(0.8, 0.88, 1.0) * (0.86 + 0.1 * sin(uTime * 1.6 + fj * 1.3));
    vec4 P = vec4(frost * fogA, fogA);

    // drips: they stick, then run, wiping a clear trail and leaving droplets behind
    float trail = 0.0;
    float dm = 0.0;
    vec2 dn = vec2(0.0);
    float tm = 0.0;
    vec2 tn = vec2(0.0);
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float hk = hash(vec2(fj, fk));
      float x0 = PR.z * (0.2 + 0.3 * fk) + sin(PD.y * 0.12 + hk * 6.0) * 1.5 * s;
      float tt = uTime * (0.35 + 0.4 * hk) + hk * 9.0;
      float slide = floor(tt) + smoothstep(0.0, 0.35, fract(tt));
      float y0 = mod(slide * PR.w * 0.22 + hk * PR.w, PR.w * 1.5) - PR.w * 0.25;
      float rH = (3.2 + 1.4 * hk) * s * (0.2 + 0.8 * wet);
      vec2 v = vec2(PD.x - x0, (PD.y - y0) * 0.72);
      float m = 1.0 - smoothstep(rH - 0.7, rH + 0.5, length(v));
      if (m > dm) { dm = m; dn = v / max(rH, 0.001); }
      float above = y0 - PD.y;
      float inTrail = step(0.0, above) * (1.0 - smoothstep(0.0, PR.w * 0.5, above));
      trail = max(trail, (1.0 - smoothstep(rH * 0.35, rH * 0.8, abs(PD.x - x0))) * inTrail);
      float segH = 9.0 * s;
      float seg = floor(above / segH);
      vec2 tv = vec2(PD.x - x0, above - (seg + 0.5) * segH);
      float tr = 1.2 * s * wet;
      float tdrop = step(0.5, hash(vec2(seg, hk * 7.0 + fk))) * inTrail * (1.0 - smoothstep(tr - 0.5, tr + 0.4, length(tv)));
      if (tdrop > tm) { tm = tdrop; tn = tv / max(tr, 0.001); }
    }
    P *= 1.0 - trail * 0.85 * wet;

    // beads of condensation, big and small; they evaporate as the window dries
    vec2 n1;
    vec2 n2;
    float b2 = beads(PD + 7.0 * s, 6.5 * s, 0.32, vec2(0.9, 1.7) * s, fj * 29.0 + 5.0, wet, n2);
    float b1 = beads(PD, 15.0 * s, 0.3, vec2(2.4, 4.6) * s, fj * 13.0, wet, n1);
    P = dropShade(P, b2, n2);
    P = dropShade(P, b1, n1);
    P = dropShade(P, tm, tn);
    P = dropShade(P, dm, dn);

    // balcony rail and frame (the frame glows amber when sheltered or hovered)
    P = over(P, FRAME * 2.2, 1.0 - step(1.2, abs(PD.y - PR.w * 0.68)));
    float edge = min(min(PD.x, PR.z - PD.x), min(PD.y, PR.w - PD.y));
    P = over(P, mix(FRAME, AMBER, PS.y), 1.0 - step(2.0 + PS.y, edge));
    return P;
  }

  void main() {
    vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    float fade = 1.0 - smoothstep(uSize.y - ${STREET_FADE.toFixed(1)}, uSize.y, p.y);

    // a light pass finds which project window (if any) this pixel is in and gathers the halos;
    // the expensive shading then runs once, outside the loop (keeps the shader compilable on D3D)
    int pj = -1;
    vec4 PR = vec4(0.0);
    vec4 PS = vec4(0.0);
    vec3 glowAdd = vec3(0.0);
    float glowA = 0.0;
    float barMix = 0.0;
    for (int j = 0; j < MAXP; j++) {
      if (j >= uProjN) break;
      vec4 r = uProj[j];
      vec4 S = uProjS[j];
      vec2 d = p - r.xy;
      if (d.x >= 0.0 && d.x <= r.z && d.y >= 0.0 && d.y <= r.w) {
        pj = j;
        PR = r;
        PS = S;
      } else if (uPass > 0.5) {
        float dist = length(max(max(-d, d - r.zw), 0.0));
        // amber halo around a sheltered / hovered window
        float halo = S.y * exp(-dist / 8.0) * step(dist, 34.0);
        // frosted windows give off a soft, slowly pulsing glow until they're dried
        float frostHalo = (1.0 - S.z) * (1.0 - S.x) * (0.28 + 0.12 * sin(uTime * 1.6 + float(j) * 1.3)) * exp(-dist / 11.0) * step(dist, 46.0);
        glowAdd += AMBER * halo * 0.5 + vec3(0.6, 0.75, 1.0) * frostHalo;
        glowA = max(glowA, max(halo * 0.6, frostHalo));
        // drying progress under the window
        float bar = step(r.y + r.w + 5.0, p.y) * step(p.y, r.y + r.w + 8.0) * step(r.x, p.x) * step(p.x, r.x + r.z * S.x);
        barMix = max(barMix, bar * step(0.001, S.x) * (1.0 - S.z));
      }
    }

    // ---- glass pass: drawn over the pixel clouds ----
    if (uPass > 0.5) {
      vec4 P = vec4(0.0);
      if (pj >= 0) {
        P = windowGlass(p - PR.xy, PR, PS, float(pj));
      } else {
        P = vec4(glowAdd, glowA);
        P = over(P, vec3(1.0, 0.85, 0.55), barMix);
      }
      P *= fade;
      gl_FragColor = vec4(P.rgb / max(P.a, 0.0001), P.a);
      return;
    }

    // ---- base pass: mid-ground, buildings, rooms ----
    vec4 B = vec4(-1.0);
    for (int i = 0; i < MAXB; i++) {
      if (i >= uBldN) break;
      vec4 b = uBld[i];
      if (p.x >= b.x && p.x < b.x + b.z && p.y >= b.y) B = b;
    }

    vec4 outCol = midLayer(p);
    if (B.z > 0.0) {
      vec2 lp = p - B.xy;
      float seed = hash(vec2(B.x, B.z));
      vec3 col = mix(vec3(0.055, 0.068, 0.1), vec3(0.085, 0.098, 0.135), seed) * mix(0.85, 1.08, vnoise(p * 0.03));
      col *= mix(0.78, 1.0, vnoise(vec2(p.x * 0.06, p.y * 0.005)));
      col += vec3(0.02, 0.028, 0.042) * smoothstep(0.6, 0.9, vnoise(vec2(p.x * 0.08, p.y * 0.015 - uTime * 0.6)));
      // lit left edge, shaded right edge, parapet cap
      col *= 1.0 + 0.35 * (1.0 - step(2.0, lp.x)) - 0.35 * step(B.z - 3.0, lp.x);
      col = mix(col, col * 1.7, 1.0 - step(5.0, lp.y));

      vec2 stepPx = uWin + uGap;
      vec2 wl = lp - uPad;
      vec2 cell = floor(wl / stepPx);
      vec2 wp = wl - cell * stepPx;
      float cols = floor((B.z - 2.0 * uPad.x + uGap.x) / stepPx.x);
      float inGrid = step(0.0, cell.x) * step(cell.x, cols - 1.0) * step(0.0, cell.y);
      if (inGrid > 0.5 && wp.x < uWin.x && wp.y < uWin.y) {
        col = apartment(wp, cell + seed * 97.0);
      } else if (step(0.0, cell.y) > 0.5 && lp.x > 2.0 && lp.x < B.z - 3.0) {
        // floor slab between storeys, with a little rain-shadow under it
        float sy = wp.y - uWin.y - uGap.y * 0.3;
        col = mix(col, col * 1.6, step(0.0, sy) * (1.0 - step(3.0, sy)));
        col *= 1.0 - 0.25 * step(3.0, sy) * (1.0 - smoothstep(3.0, 10.0, sy));
      }

      // atmospheric perspective
      col = mix(col, HAZE, B.w * 0.4);
      col += vec3(0.3, 0.33, 0.45) * uFlash * (0.5 - B.w * 0.2);
      outCol = vec4(col, 1.0);
    } else {
      // rooftop props: find the building whose roof this pixel is above, then draw once
      vec4 RB = vec4(-1.0);
      for (int i = 0; i < MAXB; i++) {
        if (i >= uBldN) break;
        vec4 b = uBld[i];
        if (p.x >= b.x - 8.0 && p.x < b.x + b.z + 8.0 && p.y < b.y && p.y > b.y - uWin.y * 1.3) RB = b;
      }
      if (RB.z > 0.0) {
        vec4 prop = roofProps(p, RB);
        prop.rgb = mix(prop.rgb, HAZE, RB.w * 0.4);
        outCol = mix(outCol, vec4(prop.rgb, 1.0), prop.a);
      }
    }

    if (pj >= 0) outCol = vec4(windowInner(p - PR.xy, PR, PS), 1.0);

    // street-level haze, then fade out entirely
    float street = smoothstep(uSize.y - ${(STREET_FADE + 140).toFixed(1)}, uSize.y, p.y);
    outCol.rgb = mix(outCol.rgb, HAZE * 1.15, street * 0.75 * outCol.a);
    outCol.a *= fade;
    gl_FragColor = outCol;
  }
`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** One row of square tiles, each project image "contain"-fitted on a dark backdrop. */
async function buildAtlas(images: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE * images.length;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${BG.join(",")})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await Promise.all(
    images.map(async (src, i) => {
      try {
        const img = await loadImage(src);
        const iw = img.naturalWidth || TILE;
        const ih = img.naturalHeight || TILE;
        const pad = TILE * 0.08;
        const k = Math.min((TILE - pad * 2) / iw, (TILE - pad * 2) / ih);
        const w = iw * k;
        const h = ih * k;
        ctx.drawImage(img, i * TILE + (TILE - w) / 2, (TILE - h) / 2, w, h);
      } catch {
        /* missing image: the window just shows its room */
      }
    }),
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

interface SkylineProps {
  images: string[];
  onReveal: (index: number) => void;
}

export default function Skyline({ images, onReveal }: SkylineProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const glassMesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const glassMatRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const [atlas, setAtlas] = useState<THREE.CanvasTexture | null>(null);
  const glow = useRef(new Float32Array(MAX_PROJECTS));
  const imagesKey = images.join("|");

  useEffect(() => {
    let cancelled = false;
    let tex: THREE.CanvasTexture | null = null;
    buildAtlas(imagesKey.split("|")).then((t) => {
      if (cancelled) return t.dispose();
      tex = t;
      setAtlas(t);
    });
    return () => {
      cancelled = true;
      tex?.dispose();
    };
  }, [imagesKey]);

  const makeUniforms = (pass: number) => ({
    uPass: { value: pass },
    uSize: { value: new THREE.Vector2(1, 1) },
    uSkyTop: { value: 0 },
    uWin: { value: new THREE.Vector2(1, 1) },
    uGap: { value: new THREE.Vector2(1, 1) },
    uPad: { value: new THREE.Vector2(1, 1) },
    uBld: { value: Array.from({ length: MAX_BUILDINGS }, () => new THREE.Vector4()) },
    uBldN: { value: 0 },
    uProj: { value: Array.from({ length: MAX_PROJECTS }, () => new THREE.Vector4()) },
    uProjS: { value: Array.from({ length: MAX_PROJECTS }, () => new THREE.Vector4()) },
    uProjN: { value: 0 },
    uAtlas: { value: null as THREE.Texture | null },
    uTiles: { value: 1 },
    uAtlasReady: { value: 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  });
  const baseUniforms = useMemo(() => makeUniforms(0), []);
  const glassUniforms = useMemo(() => makeUniforms(1), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = rainStore;
    const L = s.layout;
    const el = s.cityEl;
    const m = mesh.current;
    const gm = glassMesh.current;
    const mats = [matRef.current, glassMatRef.current].filter((x): x is THREE.ShaderMaterial => !!x);
    if (!L || !el || !m || !gm || mats.length < 2) {
      if (m) m.visible = false;
      if (gm) gm.visible = false;
      return;
    }
    const n = Math.min(L.windows.length, MAX_PROJECTS);
    const rect = el.getBoundingClientRect();

    // ---- drying simulation ----
    if (s.refogRequested) {
      s.refogRequested = false;
      s.dryness.fill(0);
      s.revealed.fill(0);
      s.boost.fill(0);
    }
    if (s.revealAllRequested) {
      s.revealAllRequested = false;
      for (let i = 0; i < n; i++) {
        if (!s.revealed[i]) {
          s.revealed[i] = 1;
          onReveal(i);
        }
      }
    }

    // The window is sheltered when it sits under the canopy: between the rim and the hand
    let sheltered = -1;
    if (umbrellaState.open > 0.6) {
      const R = umbrellaState.radiusPx;
      const zoneTop = umbrellaState.gy - SHAFT * R - 8;
      const zoneBottom = umbrellaState.gy + 14;
      for (let i = 0; i < n; i++) {
        const w = L.windows[i];
        const cx = rect.left + w.x + w.w / 2;
        const cy = rect.top + w.y + w.h / 2;
        if (Math.abs(cx - umbrellaState.gx) < R * 0.85 && cy > zoneTop && cy < zoneBottom) {
          sheltered = i;
          break;
        }
      }
    }
    s.sheltered = sheltered;

    for (let i = 0; i < n; i++) {
      if (s.revealed[i]) {
        s.dryness[i] = 1;
      } else {
        let d = s.dryness[i];
        d += i === sheltered ? dt / DRY_SECONDS : -dt / REFOG_SECONDS;
        if (s.boost[i] > 0) {
          d += s.boost[i] * dt;
          s.boost[i] = Math.max(0, s.boost[i] - dt * 2);
        }
        d = THREE.MathUtils.clamp(d, 0, 1);
        s.dryness[i] = d;
        if (d >= 1) {
          s.revealed[i] = 1;
          onReveal(i);
        }
      }
    }

    // ---- place the city plane exactly over the container ----
    const visible = rect.bottom > 0 && rect.top < size.height;
    m.visible = visible;
    gm.visible = visible;
    // the distant skyline rises from just behind the mid-ground row
    s.roofY = rect.top + L.skyTop + (L.height - L.skyTop) * 0.2;
    // the wet street picks up where the buildings start to dissolve
    s.streetTop = rect.top + window.scrollY + L.height - STREET_FADE;
    if (!visible) return;
    const k = worldPerPixel(size.height, 0);
    const [cx, cy] = pxToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, size.width, size.height, 0);
    m.position.set(cx, cy, 0);
    m.scale.set(rect.width * k, rect.height * k, 1);
    gm.position.copy(m.position);
    gm.scale.copy(m.scale);

    for (let i = 0; i < n; i++) {
      const hot = s.sheltered === i || s.pointer.overLink === i ? 1 : 0;
      glow.current[i] += (hot - glow.current[i]) * Math.min(1, dt * 8);
      // ease the visual dryness so jumps (flash / reveal all) still animate
      s.shown[i] += (s.dryness[i] - s.shown[i]) * Math.min(1, dt * 5);
    }

    // ---- uniforms (through the material: R3F copies uniform values) ----
    for (const mat of mats) {
      const u = mat.uniforms;
      u.uSize.value.set(L.width, L.height);
      u.uSkyTop.value = L.skyTop;
      u.uWin.value.set(L.win.w, L.win.h);
      u.uGap.value.set(L.gap.x, L.gap.y);
      u.uPad.value.set(L.pad.x, L.pad.top);
      const nb = Math.min(L.buildings.length, MAX_BUILDINGS);
      for (let i = 0; i < nb; i++) {
        const b = L.buildings[i];
        u.uBld.value[i].set(b.x, b.top, b.w, b.depth);
      }
      u.uBldN.value = nb;
      for (let i = 0; i < n; i++) {
        const w = L.windows[i];
        u.uProj.value[i].set(w.x, w.y, w.w, w.h);
        u.uProjS.value[i].set(s.shown[i], glow.current[i], s.revealed[i], w.project);
      }
      u.uProjN.value = n;
      u.uAtlas.value = atlas;
      u.uTiles.value = images.length;
      u.uAtlasReady.value = atlas ? 1 : 0;
      u.uTime.value = state.clock.elapsedTime;
      u.uFlash.value = s.flash;
    }
  });

  return (
    <>
      <mesh ref={mesh} renderOrder={0} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={baseUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      {/* the glass of the project windows, over the pixel clouds (renderOrder 1) */}
      <mesh ref={glassMesh} renderOrder={2} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={glassMatRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={glassUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
