"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, CloudLightning, CloudRain, LayoutGrid, RotateCcw } from "lucide-react";
import { rainStore } from "./store";
import { cityHeight, computeCityLayout, POOL_H, type CityLayout } from "./layout";

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
const CARD_W = 280;
const HIT = 8; // px of forgiveness around each small project window

const shortTitle = (t: string) => t.replace(/\s*\(.*?\)\s*/g, " ").trim();

/** Centre a window's name tag under it, but pin it inside the city near the screen edges. */
function tagStyle(w: { x: number; y: number; w: number; h: number }, width: number, maxW: number) {
  const cx = w.x + w.w / 2;
  const top = w.y + w.h + 8;
  const half = maxW / 2;
  // never wider than its column, so neighbouring tags can't overlap; pinned inside the city at the edges
  const left = Math.max(4, Math.min(cx - half, width - maxW - 4));
  return { left, top, width: maxW };
}

/** Which revealed (clickable) project, if any, is under the mouse right now. */
function refreshOverLink() {
  const ptr = rainStore.pointer;
  if (!ptr.seen || ptr.planted) {
    ptr.overLink = -1;
    return;
  }
  const link = document.elementFromPoint(ptr.x, ptr.y)?.closest("a[data-revealed]");
  ptr.overLink = link ? Number(link.getAttribute("data-index")) : -1;
}

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
  /** The profile card: projected by the bat-signal in the rain view, shown under a title in list view. */
  about?: ReactNode;
  aboutTitle?: ReactNode;
}

export default function RainProjects({ items, renderList, about, aboutTitle }: RainProjectsProps) {
  const [mode, setMode] = useState<ViewMode>("rain");
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() => items.map(() => false));
  const [layout, setLayout] = useState<CityLayout | null>(null);
  // project whose detail card is showing (hovered / focused / tapped)
  const [card, setCard] = useState(-1);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the profile card pop-up opened from the signal
  const [profileOpen, setProfileOpen] = useState(false);
  const closeProfileRef = useRef<HTMLButtonElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const signalCardRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
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

  // Lay the city out from the container's size; the shader reads the same layout from the store
  useEffect(() => {
    if (mode !== "rain") return;
    const el = cityRef.current;
    if (!el) return;
    let lastKey = "";
    const update = () => {
      // the header floats in the sky; buildings start just under it
      const skyTop = (headerRef.current?.offsetHeight ?? 0) + 12;
      const h = cityHeight(window.innerWidth, window.innerHeight, skyTop);
      const key = `${el.clientWidth}x${h}x${skyTop}`;
      if (key === lastKey) return;
      lastKey = key;
      const next = computeCityLayout(el.clientWidth, h, items.length, skyTop);
      rainStore.layout = next;
      setLayout(next);
    };
    rainStore.cityEl = el;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      rainStore.cityEl = null;
      rainStore.layout = null;
    };
  }, [mode, items.length]);

  // Profile pop-up: focus the close button, close on Escape, hand focus back to the signal
  useEffect(() => {
    if (!profileOpen) return;
    const opener = signalCardRef.current;
    closeProfileRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProfileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [profileOpen]);

  // The bat-signal: the scene aims its searchlight at this button
  useEffect(() => {
    if (mode !== "rain") return;
    rainStore.signalCardEl = signalCardRef.current;
    return () => {
      rainStore.signalCardEl = null;
    };
  }, [mode]);

  // Hide the beams background and track the pointer while the rain view is active
  useEffect(() => {
    if (mode !== "rain") return;
    document.documentElement.dataset.rain = "on";
    const ptr = rainStore.pointer;

    const updateInside = () => {
      const el = cityRef.current;
      if (!el || ptr.planted) return;
      const r = el.getBoundingClientRect();
      // the umbrella only comes out below the header, over the buildings
      const skyBottom = headerRef.current?.getBoundingClientRect().bottom ?? r.top;
      ptr.inside = ptr.x > r.left && ptr.x < r.right && ptr.y > skyBottom && ptr.y < r.bottom;
    };

    const updateIntensity = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      rainStore.intensity = 0.4 + 0.3 * progress; // heavier as you scroll, but keep the content readable
    };

    // ripples follow the cursor through the street puddles below the city
    let lastRipple = { x: 0, y: 0, t: 0 };
    const addRipple = (x: number, docY: number) => {
      const now = performance.now() / 1000;
      if (!(docY > rainStore.streetTop)) return;
      if (now - lastRipple.t < 0.09 && Math.hypot(x - lastRipple.x, docY - lastRipple.y) < 40) return;
      lastRipple = { x, y: docY, t: now };
      const r = rainStore.ripples[rainStore.rippleNext];
      r.x = x;
      r.y = docY;
      r.t = now;
      rainStore.rippleNext = (rainStore.rippleNext + 1) % rainStore.ripples.length;
    };

    const onMove = (e: PointerEvent) => {
      addRipple(e.clientX, e.clientY + window.scrollY);
      if (e.pointerType === "touch") return;
      ptr.planted = false;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.seen = true;
      updateInside();
      refreshOverLink();
    };

    const onDown = (e: PointerEvent) => {
      lastPointerType.current = e.pointerType;
      addRipple(e.clientX, e.clientY + window.scrollY);
      if (e.pointerType !== "touch") return;
      const el = cityRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      // tapping the open card itself shouldn't move the umbrella
      if ((e.target as Element).closest("[data-card]")) return;
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
      refreshOverLink();
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
      ptr.overLink = -1;
    };
  }, [mode]);

  // A window that just dried under the cursor becomes clickable (and shows its card) straight away
  useEffect(() => {
    refreshOverLink();
    const over = rainStore.pointer.overLink;
    if (over >= 0 && revealed[over]) setCard(over);
  }, [revealed]);

  const handleReveal = useCallback((i: number) => {
    setRevealed((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  }, []);

  const showCard = (i: number) => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    setCard(i);
  };
  const hideCardSoon = () => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => setCard(-1), 180);
  };

  const flash = () => {
    rainStore.flashRequested = true;
    rainStore.revealAllRequested = true;
  };

  const refog = () => {
    rainStore.refogRequested = true;
    setRevealed(items.map(() => false));
    setCard(-1);
  };

  const anyRevealed = revealed.some(Boolean);
  const showRain = mode === "rain";
  const inSky = showRain && !!about;

  const renderCard = () => {
    if (!layout || card < 0 || !revealed[card]) return null;
    const w = layout.windows.find((x) => x.project === card);
    const item = items[card];
    if (!w || !item) return null;
    const external = item.url?.startsWith("http");
    const cardW = Math.min(CARD_W, layout.width - 16);
    let left = w.x + w.w + 16;
    if (left + cardW > layout.width - 8) left = w.x - 16 - cardW;
    left = Math.max(8, Math.min(left, layout.width - cardW - 8));
    const top = Math.max(8, Math.min(w.y + w.h / 2 - 150, layout.height - 330));
    return (
      <a
        data-card
        data-index={card}
        data-revealed=""
        href={item.url ?? "#"}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{ left, top, width: cardW }}
        onPointerEnter={() => showCard(card)}
        onPointerLeave={(e) => e.pointerType !== "touch" && hideCardSoon()}
        className="group absolute z-10 overflow-hidden rounded-xl border border-amber-200/25 bg-slate-950/90 text-left shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(255,180,90,0.15)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="relative h-36 w-full bg-[#0b1220]">
          <Image src={item.image} alt="" fill sizes="280px" className="object-contain p-3" />
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold leading-snug text-white transition-colors group-hover:text-amber-100">
            {item.title}
          </h3>
          <p className="mt-1.5 font-sans text-xs leading-relaxed text-slate-300 line-clamp-4">{item.subtitle}</p>
          <p className="mt-3 flex items-center justify-between font-sans text-xs">
            <span className="text-sky-300/90">{item.handle}</span>
            <span className="flex items-center gap-1 text-amber-200/90">
              View project <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </p>
        </div>
      </a>
    );
  };

  return (
    <>
      <section
        className="relative w-full flex flex-col items-center"
        style={{ minHeight: showRain ? (layout?.height ?? 640) : undefined }}
        aria-labelledby="projects-heading"
      >
        {showRain && ready && <RainScene images={items.map((p) => p.image)} onReveal={handleReveal} />}

        <header
          ref={headerRef}
          className={
            inSky
              ? "relative z-20 w-full max-w-6xl px-4 sm:px-8 pt-8 pb-6 flex flex-col md:flex-row items-center justify-between gap-6"
              : "relative z-20 w-full max-w-6xl px-4 pt-10 pb-4 text-center flex flex-col items-center gap-3"
          }
        >
          <div
            className={
              inSky
                ? "flex flex-col items-center md:items-start text-center md:text-left gap-3 md:max-w-lg"
                : "contents"
            }
          >
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
                  Some windows in the city are frosted over. Hold your umbrella over one to dry it and see what&apos;s
                  inside.
                </span>
                <span className="hidden pointer-coarse:inline">
                  Some windows are frosted over. Tap one to plant your umbrella over it.
                </span>
              </p>
            )}

            <div
              className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-sans text-sm ${inSky ? "md:justify-start" : ""}`}
            >
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
                  {/* Always laid out (dimmed until needed) so revealing a window never shifts the city */}
                  <button
                    type="button"
                    onClick={refog}
                    disabled={!anyRevealed}
                    className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/60 px-4 py-2 text-slate-200 backdrop-blur hover:bg-white/10 transition ${
                      anyRevealed ? "opacity-100" : "opacity-40 cursor-not-allowed"
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
          </div>

          {/* the profile card, projected into the sky by a searchlight on a rooftop below it */}
          {/* the signal in the sky: drawn by the scene, this is just its hit-area */}
          {inSky && (
            <div className="flex shrink-0 flex-col items-center gap-2">
              <button
                ref={signalCardRef}
                type="button"
                onClick={() => setProfileOpen(true)}
                onPointerEnter={() => (rainStore.signalHover = true)}
                onPointerLeave={() => (rainStore.signalHover = false)}
                onFocus={() => (rainStore.signalHover = true)}
                onBlur={() => (rainStore.signalHover = false)}
                aria-haspopup="dialog"
                aria-label="Open Tom's profile card"
                className="h-44 w-44 sm:h-60 sm:w-60 md:h-64 md:w-64 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
              />
              <span className="font-sans text-[11px] tracking-[0.25em] uppercase text-amber-100/60">
                Answer the signal
              </span>
            </div>
          )}
        </header>

        {showRain ? (
          <div
            ref={cityRef}
            className="umbrella-zone absolute inset-x-0 top-0"
            style={{ height: layout?.height ?? 640 }}
          >
            {layout && (
              <ul>
                {layout.windows.map((w) => {
                  const i = w.project;
                  const item = items[i];
                  if (!item) return null;
                  const isOpen = revealed[i];
                  const external = item.url?.startsWith("http");
                  return (
                    <li key={item.title}>
                      <a
                        data-index={i}
                        data-revealed={isOpen ? "" : undefined}
                        href={item.url ?? "#"}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        style={{ left: w.x - HIT, top: w.y - HIT, width: w.w + HIT * 2, height: w.h + HIT * 2 }}
                        className="absolute rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                        onClick={(e) => {
                          const touch = lastPointerType.current === "touch";
                          if (!isOpen) {
                            // A frosted window can't be opened yet: a click speeds up drying,
                            // a tap just plants the umbrella (handled by the pointerdown listener)
                            e.preventDefault();
                            if (!touch) rainStore.boost[i] = 3;
                          } else if (touch && card !== i) {
                            // On touch, the first tap on a dry window shows its card
                            e.preventDefault();
                            showCard(i);
                          }
                        }}
                        onPointerEnter={(e) => {
                          if (e.pointerType !== "touch" && isOpen) showCard(i);
                        }}
                        onPointerLeave={(e) => {
                          if (e.pointerType !== "touch") hideCardSoon();
                        }}
                        onFocus={() => {
                          // Keyboard users get the window dried straight away
                          if (!isOpen && lastPointerType.current !== "touch") rainStore.boost[i] = 6;
                          if (isOpen) showCard(i);
                        }}
                        onBlur={hideCardSoon}
                      >
                        <span className="sr-only">
                          {item.title}: {item.subtitle}
                        </span>
                      </a>
                      {/* name tag hung under a window once it's dry */}
                      <span
                        aria-hidden="true"
                        style={tagStyle(w, layout.width, layout.win.w + layout.gap.x - 6)}
                        className={`pointer-events-none absolute flex justify-center text-center font-sans text-[10px] leading-tight sm:text-[11px] text-amber-100 transition-opacity duration-500 ${
                          isOpen ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <span className="rounded-md border border-amber-200/40 bg-slate-950/85 px-1.5 py-0.5 shadow-[0_0_12px_rgba(255,190,110,0.25)]">
                          {shortTitle(item.title)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {renderCard()}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center px-4 pb-8">{renderList()}</div>
        )}
      </section>

      {about &&
        (showRain ? (
          // the pool and waterfalls start under the city; what follows begins below the pool, in the grotto
          <div aria-hidden="true" style={{ height: POOL_H }} />
        ) : (
          <div className="w-full flex flex-col items-center gap-14 pt-14">
            {aboutTitle}
            {about}
          </div>
        ))}
      {profileOpen && about && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tom's profile"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setProfileOpen(false)}
        >
          <div className="relative animate-in zoom-in-90 fade-in duration-300">
            <button
              ref={closeProfileRef}
              type="button"
              onClick={() => setProfileOpen(false)}
              aria-label="Close"
              className="absolute -top-12 right-0 z-10 rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 font-sans text-sm text-slate-200 hover:bg-white/10"
            >
              Close ✕
            </button>
            {about}
          </div>
        </div>
      )}
    </>
  );
}
