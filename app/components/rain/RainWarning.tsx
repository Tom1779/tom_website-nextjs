"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloudRain } from "lucide-react";

interface RainWarningProps {
  /** "software": acceleration is off; "unknown": the browser can't say */
  gpu: "software" | "unknown";
  onConfirm: () => void;
  onClose: () => void;
}

/** Asked before switching to the rain city on a machine where it may lag. */
export default function RainWarning({ gpu, onConfirm, onClose }: RainWarningProps) {
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [onClose]);

  // no backdrop blur: Firefox without acceleration (who sees this most) repaints it every frame
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rain-warning-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-sky-300/25 bg-slate-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:p-7 animate-in zoom-in-95 fade-in duration-200">
        <p className="mb-2 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.3em] text-sky-200/80">
          <CloudRain className="h-4 w-4" aria-hidden="true" /> Before you head out
        </p>
        <h2 id="rain-warning-title" className="mb-3 text-xl font-semibold text-white">
          The rain works best with hardware acceleration
        </h2>
        <p className="font-sans text-sm leading-relaxed text-slate-300">
          The rainy city is a fully animated 3D scene.{" "}
          {gpu === "software"
            ? "Hardware acceleration looks to be turned off in your browser, so it will probably lag here."
            : "It runs smoothly with hardware acceleration turned on, but may lag without it, and this browser can't tell us which you have."}
        </p>
        <p className="mt-3 font-sans text-xs leading-relaxed text-slate-400">
          You can switch back any time with &ldquo;Skip to list view&rdquo;.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3 font-sans text-sm">
          <button
            ref={stayRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10"
          >
            Stay here
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full border border-sky-300/50 bg-sky-300/15 px-4 py-2 text-sky-50 hover:bg-sky-300/25"
          >
            <CloudRain className="h-4 w-4" aria-hidden="true" /> Show me the rain
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
