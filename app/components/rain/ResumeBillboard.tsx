"use client";

import { useEffect, useState } from "react";
import { AWNING_ZONE, BILLBOARD_LAMP, BILLBOARD_PAD, type Rect } from "./layout";
import { rainStore } from "./store";

// Same pdf.js build the résumé viewer uses, loaded from the CDN at runtime (bundling pdfjs-dist directly
// drags in its Node-only "canvas" dependency)
const PDFJS = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDF_WORKER = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (url: string) => {
    promise: Promise<{
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      }>;
      destroy: () => void;
    }>;
  };
}

function loadPdfJs(): Promise<PdfJsLib> {
  const w = window as unknown as { pdfjsLib?: PdfJsLib };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  return new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = PDFJS;
    tag.async = true;
    tag.onload = () => (w.pdfjsLib ? resolve(w.pdfjsLib) : reject(new Error("pdf.js missing")));
    tag.onerror = reject;
    document.head.appendChild(tag);
  });
}

/** Render page 1 of the résumé PDF to an image, so the billboard always shows the current version. */
export function useResumeThumb(url: string) {
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!url) return;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        const doc = await pdfjs.getDocument(url).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 700 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        if (!cancelled) setSrc(canvas);
        doc.destroy();
      } catch {
        /* no thumbnail: the billboard still works as a button */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return src;
}

const PAPER = 8.5 / 11;
const SCALE = 2; // draw the sign at 2x for crisp text

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paint the whole sign (lamps, frame, title, the résumé's first page, lamp light and a wet sheen) onto a
 * canvas. The 3D scene shows it as a textured plane, so the scene's rain falls in front of it.
 * Canvas = the sign rect grown by BILLBOARD_PAD on every side, plus BILLBOARD_LAMP more on top.
 */
function drawSign(rect: Rect, thumb: HTMLCanvasElement | null) {
  const pad = BILLBOARD_PAD;
  const W = rect.w + pad * 2;
  const H = rect.h + pad * 2 + BILLBOARD_LAMP;
  const c = document.createElement("canvas");
  c.width = Math.round(W * SCALE);
  c.height = Math.round(H * SCALE);
  const ctx = c.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  const sx = pad;
  const sy = pad + BILLBOARD_LAMP;

  // warm glow around the sign
  ctx.save();
  ctx.shadowColor = "rgba(255,200,120,0.35)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#10141f";
  roundRect(ctx, sx, sy, rect.w, rect.h, 3);
  ctx.fill();
  ctx.restore();

  // gooseneck lamps along the top edge
  const lampXs = [1 / 6, 1 / 2, 5 / 6].map((f) => sx + rect.w * f);
  for (const lx of lampXs) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(lx - 2, sy - BILLBOARD_LAMP + 2, 4, BILLBOARD_LAMP - 2);
    ctx.fillStyle = "#475569";
    roundRect(ctx, lx - 10, sy - 8, 20, 6, 3);
    ctx.fill();
  }

  // frame and face
  const inX = sx + 3;
  const inY = sy + 3;
  const innerW = rect.w - 6;
  const innerH = rect.h - 6;
  ctx.fillStyle = "#1e293b";
  roundRect(ctx, sx, sy, rect.w, rect.h, 3);
  ctx.fill();
  ctx.fillStyle = "#10141f";
  ctx.fillRect(inX, inY, innerW, innerH);

  // the résumé is always shown whole, at real letter-paper proportions; only the layout around it adapts
  const wide = innerW - innerH * PAPER >= 150; // room for the headline beside the page?
  // title strip at the top, then the page (AWNING_ZONE reserves room above the title if the awning needs it)
  const strip = wide ? 0 : 24;
  const avail = innerH - AWNING_ZONE;
  const paperH = wide ? avail : Math.min(avail - strip, innerW / PAPER);
  const paperW = paperH * PAPER;
  const px = wide ? inX : inX + (innerW - paperW) / 2;
  const py = inY + AWNING_ZONE + strip;
  const titleY = inY + AWNING_ZONE + strip / 2;

  ctx.textBaseline = "middle";
  if (!wide) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("RÉSUMÉ", inX + 8, titleY);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "rgba(254,243,199,0.9)";
    ctx.font = "13px sans-serif";
    ctx.fillText("↗", inX + innerW - 18, titleY);
  }

  // the résumé: always the whole first page
  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(px, py, paperW, paperH);
  if (thumb) {
    const k = Math.min(paperW / thumb.width, paperH / thumb.height);
    const tw = thumb.width * k;
    const th = thumb.height * k;
    ctx.drawImage(thumb, px + (paperW - tw) / 2, py + (paperH - th) / 2, tw, th);
  }

  if (wide) {
    const tx = px + paperW + 16;
    const cy = py + paperH / 2;
    ctx.fillStyle = "rgba(253,230,138,0.7)";
    ctx.font = "10px sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("NOW SHOWING", tx, cy - 34);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${innerW > 420 ? 32 : 24}px Orbitron, sans-serif`;
    ctx.fillText("RÉSUMÉ", tx, cy - 6);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px sans-serif";
    ctx.fillText("Tom Arad · Software Engineer", tx, cy + 22);
    ctx.fillStyle = "rgba(254,243,199,0.9)";
    ctx.fillText("Click to read ↗", tx, cy + 42);
  }

  // lamp light washing down the face, and a wet sheen
  ctx.save();
  ctx.beginPath();
  ctx.rect(inX, inY, innerW, innerH);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  for (const lx of lampXs) {
    const g = ctx.createRadialGradient(lx, inY - 10, 0, lx, inY - 10, innerH * 0.75);
    g.addColorStop(0, "rgba(255,225,160,0.32)");
    g.addColorStop(1, "rgba(255,225,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(inX, inY, innerW, innerH);
  }
  ctx.globalCompositeOperation = "source-over";
  const sheen = ctx.createLinearGradient(inX, inY, inX + innerW, inY + innerH);
  sheen.addColorStop(0.4, "rgba(255,255,255,0)");
  sheen.addColorStop(0.48, "rgba(255,255,255,0.07)");
  sheen.addColorStop(0.56, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(inX, inY, innerW, innerH);
  ctx.restore();
  return c;
}

interface ResumeBillboardProps {
  rect: Rect;
  url: string;
  onOpen: () => void;
}

/**
 * The résumé billboard on the middle building. Its picture is drawn by the 3D scene (so the rain falls in
 * front of it); this is the invisible, focusable hit area over it. Click to read the résumé.
 */
export default function ResumeBillboard({ rect, url, onOpen }: ResumeBillboardProps) {
  const thumb = useResumeThumb(url);

  // repaint the sign whenever its size or the résumé thumbnail changes, and hand it to the scene
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      rainStore.billboardCanvas = drawSign(rect, thumb);
      rainStore.billboardVersion++;
    });
    return () => {
      alive = false;
    };
  }, [rect, thumb]);
  useEffect(
    () => () => {
      rainStore.billboardCanvas = null;
      rainStore.billboardHover = false;
    },
    [],
  );

  const hover = (on: boolean) => () => {
    rainStore.billboardHover = on;
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onFocus={hover(true)}
      onBlur={hover(false)}
      data-revealed=""
      data-index={-2}
      aria-haspopup="dialog"
      aria-label="Open Tom's résumé"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      className="billboard absolute rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
    />
  );
}
