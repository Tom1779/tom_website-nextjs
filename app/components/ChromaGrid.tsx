import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";

export interface ChromaItem {
  image: string;
  title: string;
  subtitle: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
}

export interface ChromaGridProps {
  items?: ChromaItem[];
  className?: string;
  radius?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
}

type SetterFn = (v: number | string) => void;

const ChromaGrid: React.FC<ChromaGridProps> = ({
  items,
  className = "",
  radius = 300,
  damping = 0.45,
  fadeOut = 0.6,
  ease = "power3.out",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const setX = useRef<SetterFn | null>(null);
  const setY = useRef<SetterFn | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const isHovering = useRef(false);

  const data = items;

  const [performanceConfig, setPerformanceConfig] = useState({
    useBackdropFilter: true,
    simplifyGradient: false,
    reducedOpacity: 1,
  });

  useEffect(() => {
    const updatePerformanceConfig = () => {
      const screenWidth = window.innerWidth;
      const pixelRatio = window.devicePixelRatio || 1;
      const effectiveWidth = screenWidth * pixelRatio;

      if (effectiveWidth > 3840) {
        setPerformanceConfig({
          useBackdropFilter: false,
          simplifyGradient: true,
          reducedOpacity: 0.7,
        });
      } else if (effectiveWidth > 2560) {
        setPerformanceConfig({
          useBackdropFilter: true,
          simplifyGradient: true,
          reducedOpacity: 0.8,
        });
      } else {
        setPerformanceConfig({
          useBackdropFilter: true,
          simplifyGradient: false,
          reducedOpacity: 1,
        });
      }
    };

    updatePerformanceConfig();
    window.addEventListener("resize", updatePerformanceConfig);
    return () => window.removeEventListener("resize", updatePerformanceConfig);
  }, []);

  const gradientMasks = useMemo(() => {
    const baseGradient = performanceConfig.simplifyGradient
      ? "radial-gradient(circle var(--r) at var(--x) var(--y), transparent 0%, transparent 20%, rgba(0,0,0,0.5) 60%, white 100%)"
      : "radial-gradient(circle var(--r) at var(--x) var(--y),transparent 0%,transparent 15%,rgba(0,0,0,0.10) 30%,rgba(0,0,0,0.22)45%,rgba(0,0,0,0.35)60%,rgba(0,0,0,0.50)75%,rgba(0,0,0,0.68)88%,white 100%)";

    const fadeGradient = performanceConfig.simplifyGradient
      ? "radial-gradient(circle var(--r) at var(--x) var(--y), white 0%, white 20%, rgba(255,255,255,0.5) 60%, transparent 100%)"
      : "radial-gradient(circle var(--r) at var(--x) var(--y),white 0%,white 15%,rgba(255,255,255,0.90)30%,rgba(255,255,255,0.78)45%,rgba(255,255,255,0.65)60%,rgba(255,255,255,0.50)75%,rgba(255,255,255,0.32)88%,transparent 100%)";

    return { baseGradient, fadeGradient };
  }, [performanceConfig.simplifyGradient]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    setX.current = gsap.quickSetter(el, "--x", "px") as SetterFn;
    setY.current = gsap.quickSetter(el, "--y", "px") as SetterFn;

    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);

    el.style.setProperty(
      "--performance-backdrop",
      performanceConfig.useBackdropFilter
        ? "grayscale(1) brightness(0.78)"
        : "none"
    );
    el.style.setProperty(
      "--performance-opacity",
      performanceConfig.reducedOpacity.toString()
    );
  }, [performanceConfig]);

  const moveTo = useCallback(
    (x: number, y: number) => {
      if (animationRef.current) {
        animationRef.current.kill();
      }

      animationRef.current = gsap.to(pos.current, {
        x,
        y,
        duration: damping,
        ease,
        onUpdate: () => {
          setX.current?.(pos.current.x);
          setY.current?.(pos.current.y);
        },
        overwrite: true,
      });
    },
    [damping, ease]
  );

  const handleMove = useCallback(
    (e: React.PointerEvent) => {
      if (!rootRef.current) return;

      const r = rootRef.current.getBoundingClientRect();
      moveTo(e.clientX - r.left, e.clientY - r.top);

      if (!isHovering.current) {
        isHovering.current = true;
        gsap.to(fadeRef.current, {
          opacity: 0,
          duration: 0.25,
          overwrite: true,
        });
      }
    },
    [moveTo]
  );

  const handleLeave = useCallback(() => {
    isHovering.current = false;
    gsap.to(fadeRef.current, {
      opacity: performanceConfig.reducedOpacity,
      duration: fadeOut,
      overwrite: true,
    });
  }, [fadeOut, performanceConfig.reducedOpacity]);

  const handleCardMove: React.MouseEventHandler<HTMLElement> = useCallback(
    (e) => {
      const c = e.currentTarget as HTMLElement;
      const rect = c.getBoundingClientRect();
      c.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      c.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    },
    []
  );

  const cardClassName =
    "group relative flex flex-col w-[300px] rounded-[20px] overflow-hidden border-2 border-transparent transition-colors duration-300 cursor-pointer no-underline";

  const cardStyle = (c: ChromaItem): React.CSSProperties => ({
    "--card-border": c.borderColor || "transparent",
    background: c.gradient,
    "--spotlight-color": "rgba(255,255,255,0.3)",
    contain: "layout style paint",
    transform: "translateZ(0)",
  } as React.CSSProperties);

  const cardInner = (c: ChromaItem) => (
    <>
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-20 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--mouse-x) var(--mouse-y), var(--spotlight-color), transparent 70%)",
          willChange: "opacity",
        }}
      />
      <div className="relative z-10 flex-1 p-[10px] box-border">
        <Image
          src={c.image}
          alt={c.title}
          height={700}
          width={700}
          className="w-full h-full object-cover rounded-[10px]"
          style={{
            imageRendering: (performanceConfig.simplifyGradient
              ? "optimizeSpeed"
              : "auto") as React.CSSProperties["imageRendering"],
          }}
        />
      </div>
      <footer className="relative z-10 p-3 text-white font-sans grid grid-rows-[1fr_auto] gap-x-3 gap-y-1">
        <h3 className="m-0 text-[1.05rem] font-semibold text-center">
          {c.title}
        </h3>
        {c.handle && (
          <span className="text-[0.95rem] opacity-80 text-center text-amber-300">
            {c.handle}
          </span>
        )}
        <p className="m-0 text-[0.85rem] opacity-85 text-center">
          {c.subtitle}
        </p>
        {c.location && (
          <span className="text-[0.85rem] opacity-85 text-right">
            {c.location}
          </span>
        )}
      </footer>
    </>
  );

  return (
    <div
      ref={rootRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`relative w-full min-h-full flex flex-wrap justify-evenly items-start gap-2 ${className}`}
      style={
        {
          "--r": `${radius}px`,
          "--x": "50%",
          "--y": "50%",
          contain: "layout style paint",
          willChange: "transform",
        } as React.CSSProperties
      }
    >
      {data?.map((c, i) =>
        c.url?.startsWith("/") ? (
          <Link
            key={i}
            href={c.url}
            onMouseMove={handleCardMove}
            className={cardClassName}
            style={cardStyle(c)}
          >
            {cardInner(c)}
          </Link>
        ) : (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseMove={handleCardMove}
            className={cardClassName}
            style={cardStyle(c)}
          >
            {cardInner(c)}
          </a>
        )
      )}

      {/* Base overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
        style={{
          backdropFilter: performanceConfig.useBackdropFilter
            ? "grayscale(1) brightness(0.78)"
            : "none",
          WebkitBackdropFilter: performanceConfig.useBackdropFilter
            ? "grayscale(1) brightness(0.78)"
            : "none",
          background: performanceConfig.useBackdropFilter
            ? "rgba(0,0,0,0.001)"
            : "rgba(0,0,0,0.2)",
          maskImage: gradientMasks.baseGradient,
          WebkitMaskImage: gradientMasks.baseGradient,
          contain: "layout style paint",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
        }}
      />

      {/* Fade overlay */}
      <div
        ref={fadeRef}
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-[250ms] z-40"
        style={{
          backdropFilter: performanceConfig.useBackdropFilter
            ? "grayscale(1) brightness(0.78)"
            : "none",
          WebkitBackdropFilter: performanceConfig.useBackdropFilter
            ? "grayscale(1) brightness(0.78)"
            : "none",
          background: performanceConfig.useBackdropFilter
            ? "rgba(0,0,0,0.001)"
            : "rgba(0,0,0,0.15)",
          maskImage: gradientMasks.fadeGradient,
          WebkitMaskImage: gradientMasks.fadeGradient,
          opacity: performanceConfig.reducedOpacity,
          contain: "layout style paint",
          willChange: "opacity",
          transform: "translateZ(0)",
        }}
      />
    </div>
  );
};

export default ChromaGrid;