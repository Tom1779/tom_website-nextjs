"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CloudLightning, CloudRain, LayoutGrid, RotateCcw } from "lucide-react";
import { rainStore } from "./store";

const RainScene = dynamic(() => import("./RainScene"), { ssr: false });

export interface RainProject {
  image: string;
  title: string;
  subtitle: string;
  handle?: string;
  url?: string;
}

type ViewMode = "rain" | "list";
const STORAGE_KEY = "tom-site-view";

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

interface RainProjectsProps {
  items: RainProject[];
  /** The plain list view (shown for reduced motion, no WebGL, or when toggled). */
  renderList: () => ReactNode;
}

export default function RainProjects({ items, renderList }: RainProjectsProps) {
  const [mode, setMode] = useState<ViewMode>("rain");
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() => items.map(() => false));
  const gridRef = useRef<HTMLUListElement>(null);
  const lastPointerType = useRef<string>("mouse");

  // Pick the initial view: saved choice > reduced motion / no WebGL > rain
  useEffect(() => {
    let initial: ViewMode = "rain";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "rain" || saved === "list") initial = saved;
      else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) initial = "list";
    } catch {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) initial = "list";
    }
    if (!supportsWebGL()) initial = "list";
    setMode(initial);
    setReady(true);
  }, []);

  const switchMode = (next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: choice lasts for this visit only */
    }
  };

  // Hide the city/beams background swap and track the pointer while the rain view is active
  useEffect(() => {
    if (mode !== "rain") return;
    document.documentElement.dataset.rain = "on";
    const ptr = rainStore.pointer;

    const updateInside = () => {
      const el = gridRef.current;
      if (!el || ptr.planted) return;
      const r = el.getBoundingClientRect();
      const pad = 40;
      ptr.inside = ptr.x > r.left - pad && ptr.x < r.right + pad && ptr.y > r.top - pad && ptr.y < r.bottom + pad;
    };

    const updateIntensity = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      rainStore.intensity = 0.4 + 0.6 * progress;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      ptr.planted = false;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.seen = true;
      updateInside();
    };

    const onDown = (e: PointerEvent) => {
      lastPointerType.current = e.pointerType;
      if (e.pointerType !== "touch") return;
      const el = gridRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      // Touch: plant the umbrella where the user tapped
      ptr.planted = true;
      ptr.seen = true;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.docY = e.clientY + window.scrollY;
    };

    const onLeave = () => {
      if (!ptr.planted) ptr.inside = false;
    };

    const onScroll = () => {
      updateInside();
      updateIntensity();
    };

    updateIntensity();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      delete document.documentElement.dataset.rain;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      ptr.inside = false;
      ptr.planted = false;
    };
  }, [mode]);

  const handleReveal = useCallback((i: number) => {
    setRevealed((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  }, []);

  const flash = () => {
    rainStore.flashRequested = true;
    rainStore.revealAllRequested = true;
  };

  const refog = () => {
    rainStore.refogRequested = true;
    setRevealed(items.map(() => false));
  };

  const anyRevealed = revealed.some(Boolean);
  const showRain = mode === "rain";

  return (
    <section className="relative w-full flex flex-col items-center" aria-labelledby="projects-heading">
      {showRain && ready && <RainScene images={items.map((p) => p.image)} onReveal={handleReveal} />}

      <header className="w-full max-w-6xl px-4 pt-10 sm:pt-16 pb-8 text-center flex flex-col items-center gap-4">
        <p className="text-xs sm:text-sm tracking-[0.35em] uppercase text-sky-200/70">Software Engineer</p>
        <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-[0_2px_18px_rgba(120,160,255,0.35)]">
          Tom Arad
        </h1>
        <h2 id="projects-heading" className="sr-only">
          Projects
        </h2>
        {showRain && (
          <p className="max-w-xl text-sm sm:text-base text-slate-300/90 font-sans">
            <span className="pointer-coarse:hidden">
              It&apos;s pouring. Hold your umbrella over a fogged pane to dry it and see what&apos;s inside.
            </span>
            <span className="hidden pointer-coarse:inline">
              It&apos;s pouring. Tap a fogged pane to plant your umbrella over it.
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-sans text-sm">
          {showRain && (
            <>
              <button
                type="button"
                onClick={flash}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200/30 bg-slate-900/60 px-4 py-2 text-sky-100 backdrop-blur hover:bg-sky-200/15 hover:border-sky-200/60 transition"
              >
                <CloudLightning className="w-4 h-4" aria-hidden="true" />
                Flash: show me everything
              </button>
              {/* Always laid out (just hidden) so revealing a pane never shifts the grid under the umbrella */}
              <button
                type="button"
                onClick={refog}
                disabled={!anyRevealed}
                aria-hidden={!anyRevealed}
                className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/60 px-4 py-2 text-slate-200 backdrop-blur hover:bg-white/10 transition ${
                  anyRevealed ? "visible opacity-100" : "invisible opacity-0"
                }`}
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Fog up again
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => switchMode(showRain ? "list" : "rain")}
            aria-pressed={!showRain}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/60 px-4 py-2 text-slate-200 backdrop-blur hover:bg-white/10 transition"
          >
            {showRain ? (
              <>
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                Skip to list view
              </>
            ) : (
              <>
                <CloudRain className="w-4 h-4" aria-hidden="true" />
                Back to the rain
              </>
            )}
          </button>
        </div>
      </header>

      {showRain ? (
        <ul
          ref={gridRef}
          className="umbrella-zone w-full max-w-6xl px-4 sm:px-6 pb-16 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-8 gap-y-8 sm:gap-y-12"
        >
          {items.map((item, i) => {
            const isOpen = revealed[i];
            const external = item.url?.startsWith("http");
            return (
              <li key={item.title} className="flex flex-col">
                <a
                  href={item.url ?? "#"}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (isOpen) return;
                    // A fogged pane can't be opened yet: a mouse click speeds up drying,
                    // a tap just plants the umbrella (handled by the pointerdown listener)
                    e.preventDefault();
                    if (lastPointerType.current !== "touch") rainStore.boost[i] = 3;
                  }}
                  onFocus={() => {
                    // Keyboard users get the pane dried straight away
                    if (!isOpen && lastPointerType.current !== "touch") rainStore.boost[i] = 6;
                  }}
                  className="group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
                >
                  <div
                    ref={(el) => {
                      rainStore.panelEls[i] = el;
                    }}
                    data-pane
                    className="relative aspect-square w-full rounded-md"
                  >
                    {/* drying progress */}
                    <div
                      aria-hidden="true"
                      className={`absolute left-2 right-2 bottom-2 h-0.5 rounded-full bg-amber-200/80 origin-left transition-opacity duration-300 ${
                        isOpen ? "opacity-0" : "opacity-100"
                      }`}
                      style={{ transform: "scaleX(var(--dry, 0))" }}
                    />
                  </div>
                  <div
                    className={`min-h-[7.5rem] sm:min-h-[6.5rem] transition-all duration-700 ${
                      isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    }`}
                  >
                    <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">{item.title}</h3>
                    <p className="mt-1 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed line-clamp-3">
                      {item.subtitle}
                    </p>
                    <p className="mt-2 text-xs font-sans text-sky-300/90 flex items-center gap-2">
                      {item.handle && <span>{item.handle}</span>}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="w-full flex flex-col items-center pb-8">{renderList()}</div>
      )}
    </section>
  );
}
