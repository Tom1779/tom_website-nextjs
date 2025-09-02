import { motion, Transition } from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  startDelay?: number; // New prop for delaying animation start
};

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
): Record<string, Array<string | number>> => {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

const BlurText: React.FC<BlurTextProps> = ({
  text = "",
  delay = 200,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  startDelay = 0, // Default no delay
}) => {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Font loading effect
  useEffect(() => {
    const checkFonts = async () => {
      try {
        // Wait for all fonts to be ready
        await document.fonts.ready;

        // Double check that Orbitron is specifically loaded
        const fontFace = new FontFace(
          "Orbitron",
          "url(https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6BoWgz.woff2)"
        );
        await fontFace.load();

        // Small delay to ensure rendering is stable
        setTimeout(() => {
          setFontsReady(true);
        }, 1000);
      } catch (error) {
        // Fallback if font loading fails
        setTimeout(() => {
          setFontsReady(true);
        }, 500);
      }
    };

    checkFonts();
  }, []);

  // Intersection observer effect - only runs after fonts are ready
  useEffect(() => {
    if (!ref.current || !fontsReady) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Configurable delay to let other elements settle
          setTimeout(() => {
            setInView(true);
          }, startDelay);
          observer.unobserve(ref.current as Element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin, fontsReady, startDelay]);

  const defaultFrom = useMemo(
    () =>
      direction === "top"
        ? { filter: "blur(8px)", opacity: 0, y: -30 } // Reduced blur and movement
        : { filter: "blur(8px)", opacity: 0, y: 30 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: "blur(4px)",
        opacity: 0.6,
        y: direction === "top" ? -10 : 10,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  );

  return (
    <p
      ref={ref}
      className={`blur-text ${className} flex flex-wrap`}
      style={{
        fontFamily: "Orbitron, Arial, sans-serif",
        visibility: fontsReady ? "visible" : "hidden", // Hide until fonts load
      }}
    >
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: "easeOut", // Better default easing
        };
        (spanTransition as any).ease = easing;

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
            style={{
              display: "inline-block",
              willChange: "transform, filter, opacity",
              transform: "translateZ(0)", // Force hardware acceleration
              backfaceVisibility: "hidden",
            }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
};

export default BlurText;
