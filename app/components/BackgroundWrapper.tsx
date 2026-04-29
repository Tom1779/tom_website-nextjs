"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const BackgroundBeams = dynamic(
  () => import("./BackgroundBeams").then((mod) => ({ default: mod.BackgroundBeams })),
  { ssr: false }
);

const BackgroundBeamsStatic = dynamic(
  () => import("./BackgroundBeamsStatic").then((mod) => ({ default: mod.BackgroundBeamsStatic })),
  { ssr: false }
);

export default function BackgroundWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsFirefox(/firefox/i.test(navigator.userAgent));
  }, []);

  if (!mounted) return <div className="fixed inset-0 -z-10 bg-neutral-950" />;

  if (pathname !== "/" && pathname !== "/about" && !pathname.startsWith("/projects")) {
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 bg-neutral-950">
      {isFirefox ? <BackgroundBeams /> : <BackgroundBeamsStatic />}
    </div>
  );
}