"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Rect } from "./layout";

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
function useResumeThumb(url: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled) setSrc(canvas.toDataURL("image/png"));
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

interface ResumeBillboardProps {
  rect: Rect;
  url: string;
  onOpen: () => void;
}

/** A lit billboard bolted to the lower storeys of a building, advertising the résumé. Click to read it. */
export default function ResumeBillboard({ rect, url, onOpen }: ResumeBillboardProps) {
  const thumb = useResumeThumb(url);
  // the résumé is always shown whole, at real letter-paper proportions; only the layout around it adapts
  const PAPER = 8.5 / 11;
  const innerW = rect.w - 6;
  const innerH = rect.h - 6;
  const wide = innerW - innerH * PAPER >= 150; // room for the headline beside the page?
  const paperH = wide ? innerH : Math.min(innerH - 26, innerW / PAPER);
  const paperW = paperH * PAPER;
  const titleSize = innerW > 420 ? "text-3xl lg:text-4xl" : "text-2xl";

  return (
    <button
      type="button"
      onClick={onOpen}
      data-revealed=""
      data-index={-2}
      aria-haspopup="dialog"
      aria-label="Open Tom's résumé"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      className="billboard group absolute overflow-visible rounded-[3px] text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
    >
      {/* gooseneck lamps along the top edge, and the light they throw down the face */}
      <span aria-hidden="true" className="pointer-events-none absolute -top-5 left-0 right-0 flex justify-around">
        {[0, 1, 2].map((i) => (
          <span key={i} className="relative block h-5 w-1 bg-slate-700">
            <span className="absolute -bottom-1 -left-2 block h-1.5 w-5 rounded-b-full bg-slate-600 shadow-[0_3px_10px_rgba(255,220,150,0.9)]" />
          </span>
        ))}
      </span>

      <span
        className={`absolute inset-0 flex ${wide ? "flex-row" : "flex-col items-center"} overflow-hidden rounded-[3px] border-[3px] border-slate-800 bg-[#10141f] shadow-[0_0_40px_rgba(255,200,120,0.18),0_8px_24px_rgba(0,0,0,0.6)] transition-shadow duration-300 group-hover:shadow-[0_0_60px_rgba(255,200,120,0.35),0_8px_24px_rgba(0,0,0,0.6)]`}
      >
        {/* narrow sign: a slim title strip above the page */}
        {!wide && (
          <span className="flex h-[26px] w-full shrink-0 items-center justify-between px-2 font-sans">
            <span
              className="text-[11px] font-bold tracking-[0.2em] text-white"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              RÉSUMÉ
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-100/90" aria-hidden="true" />
          </span>
        )}

        {/* the résumé itself, like a poster pasted on the sign: always the whole first page */}
        <span
          style={{ width: paperW, height: paperH }}
          className="relative flex shrink-0 items-center justify-center overflow-hidden bg-[#e9e4d8]"
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <span className="m-auto font-serif text-sm text-slate-500">Résumé</span>
          )}
        </span>

        {/* headline beside the page on wide signs */}
        {wide && (
          <span className="flex flex-1 flex-col justify-center gap-1.5 px-4 font-sans">
            <span className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">Now showing</span>
            <span
              className={`font-bold leading-none text-white drop-shadow-[0_0_12px_rgba(255,220,160,0.45)] ${titleSize}`}
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              RÉSUMÉ
            </span>
            <span className="text-xs text-slate-300">Tom Arad · Software Engineer</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-100/90 transition-colors group-hover:text-amber-50">
              Click to read <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        )}

        {/* lamp light washing down from the top, and a wet sheen */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_-10%,rgba(255,225,160,0.35),transparent_55%),radial-gradient(ellipse_at_50%_-10%,rgba(255,225,160,0.3),transparent_55%),radial-gradient(ellipse_at_80%_-10%,rgba(255,225,160,0.35),transparent_55%)] mix-blend-screen"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.07)_48%,transparent_56%)]"
        />
      </span>
    </button>
  );
}
