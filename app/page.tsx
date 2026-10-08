"use client";

import { useMemo, useState, useEffect } from "react";
import ProfileCard from "./components/ProfileCard";
import ChromaGrid from "./components/ChromaGrid";
import RainProjects from "./components/rain/RainProjects";
import AboutDetails from "./components/AboutDetails";
import { useGpu } from "./components/useGpu";
import { items } from "./data/items";

const ACCENTS: Record<string, string> = {
  "@nextjs": "#818cf8",
  "@flutter": "#38bdf8",
  "@tensorflow": "#f59e0b",
  "@sklearn": "#34d399",
  "@valheim": "#f87171",
};

export default function Home() {
  // without hardware acceleration, skip the expensive CSS effects
  const gpu = useGpu();
  const lite = gpu !== null && gpu !== "ok";
  // Memoize items to prevent unnecessary re-renders
  const memoizedItems = useMemo(() => items, []);

  // the simple view tints each project card by its stack
  const accentedItems = useMemo(
    () =>
      items.map((it) => {
        const accent = ACCENTS[it.handle ?? ""] ?? "#64748b";
        return {
          ...it,
          borderColor: accent,
          gradient: `linear-gradient(160deg, ${accent}33 0%, rgba(15,20,40,0.85) 55%, rgba(10,14,30,0.92) 100%)`,
        };
      }),
    [],
  );

  // Scale grid properties based on screen size for performance
  const [gridConfig, setGridConfig] = useState({
    radius: 300,
    damping: 0.45,
    fadeOut: 0.6,
    ease: "power3.out",
  });

  useEffect(() => {
    const updateGridConfig = () => {
      const screenWidth = window.innerWidth;
      const pixelRatio = window.devicePixelRatio || 1;

      // More aggressive optimization for high-DPI and large screens
      if (screenWidth > 2560 || pixelRatio > 2) {
        setGridConfig({
          radius: 180,
          damping: 0.7,
          fadeOut: 0.8,
          ease: "power2.out",
        });
      } else if (screenWidth > 1920) {
        setGridConfig({
          radius: 200,
          damping: 0.6,
          fadeOut: 0.8,
          ease: "power2.out",
        });
      } else if (screenWidth > 1200) {
        setGridConfig({
          radius: 250,
          damping: 0.5,
          fadeOut: 0.7,
          ease: "power2.out",
        });
      } else {
        setGridConfig({
          radius: 300,
          damping: 0.45,
          fadeOut: 0.6,
          ease: "power3.out",
        });
      }
    };

    updateGridConfig();
    window.addEventListener("resize", updateGridConfig);

    return () => window.removeEventListener("resize", updateGridConfig);
  }, []);

  return (
    <>
      <main className="relative z-0 text-white flex flex-col items-center justify-center flex-1 gap-14">
        {/* Rain & umbrella hero: projects behind fogged glass (list view fallback inside) */}
        <RainProjects
          items={memoizedItems}
          renderList={() => (
            <div className="relative w-full">
              <ChromaGrid
                items={accentedItems}
                variant="tiles"
                radius={gridConfig.radius}
                damping={gridConfig.damping}
                fadeOut={gridConfig.fadeOut}
                ease={gridConfig.ease}
              />
            </div>
          )}
          renderAboutDetails={(onResume) => <AboutDetails onResume={onResume} />}
          resumeUrl="TomArad-Resume.pdf"
          about={
            <ProfileCard
              name="Tom Arad"
              title="Software Engineer"
              handle="tom.arad.2001"
              status="Online"
              contactText="Linkedin"
              avatarUrl="/ME.png"
              showUserInfo={true}
              enableTilt={true}
              lite={lite}
              enableMobileTilt={false}
              onContactClick={() => {
                window.open("https://www.linkedin.com/in/tom-arad/", "_blank");
              }}
            />
          }
        />
      </main>
    </>
  );
}
