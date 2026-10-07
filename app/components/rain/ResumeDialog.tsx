"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2 } from "lucide-react";

const PDFViewer = dynamic(() => import("../PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 font-sans text-slate-400">
      Loading résumé…
    </div>
  ),
});

interface ResumeDialogProps {
  url: string;
  onClose: () => void;
}

/** The résumé, opened from the billboard: a large reader with fullscreen and download links. */
export default function ResumeDialog({ url, onClose }: ResumeDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const btn =
    "inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 font-sans text-sm text-slate-200 hover:bg-white/10";

  // portalled to <body>: <main> is its own stacking context, which would leave the navbar on top
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tom's résumé"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex h-[90svh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-slate-950/90 shadow-[0_20px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(255,200,120,0.12)] animate-in zoom-in-95 fade-in duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-amber-200/80">Résumé</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/viewer?file=${url}`} target="_blank" rel="noopener noreferrer" className={btn}>
              <Maximize2 className="h-4 w-4" aria-hidden="true" /> Fullscreen
            </a>
            <a href={`/${url}`} download className={btn}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download
            </a>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className={btn}>
              Close ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-white">
          <PDFViewer fileUrl={url} showToolbar={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
