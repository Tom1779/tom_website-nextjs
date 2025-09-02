"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Make BackgroundBeams client-only to prevent hydration mismatch
const BackgroundBeams = dynamic(
  () =>
    import("./BackgroundBeams").then((mod) => ({
      default: mod.BackgroundBeams,
    })),
  {
    ssr: false,
  }
);

export default function BackgroundWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="fixed inset-0 -z-10 bg-neutral-950" />;
  }

  // Only render on homepage ("/") and about page
  if (pathname !== "/" && pathname !== "/about") {
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 bg-neutral-950">
      <BackgroundBeams />
    </div>
  );
}
