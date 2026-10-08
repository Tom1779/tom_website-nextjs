"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getGpu } from "./rain/gpu";

const BackgroundBeams = dynamic(() => import("./BackgroundBeams").then((mod) => ({ default: mod.BackgroundBeams })), {
  ssr: false,
});

const BackgroundBeamsStatic = dynamic(
  () => import("./BackgroundBeamsStatic").then((mod) => ({ default: mod.BackgroundBeamsStatic })),
  { ssr: false },
);

export default function BackgroundWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [lite, setLite] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsFirefox(/firefox/i.test(navigator.userAgent));
    setLite(getGpu() !== "ok");
  }, []);

  if (!mounted) return <div className="fixed inset-0 -z-10 bg-neutral-950" />;

  if (pathname !== "/" && pathname !== "/about" && !pathname.startsWith("/projects")) {
    return null;
  }

  return (
    <div data-bg-beams className="fixed inset-0 -z-10 bg-neutral-950">
      {lite ? (
        // without hardware acceleration the blurred, animated aurora repaints the whole screen every
        // frame; a plain static glow in the same colours costs nothing
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(20,184,166,0.16), rgba(16,185,129,0.06) 55%, transparent 80%)",
          }}
        />
      ) : isFirefox ? (
        <BackgroundBeams />
      ) : (
        <BackgroundBeamsStatic />
      )}
    </div>
  );
}
