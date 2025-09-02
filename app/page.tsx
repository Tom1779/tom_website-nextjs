"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState, useEffect } from "react";
import ProfileCard from "./components/ProfileCard";
import ChromaGrid from "./components/ChromaGrid";
import BlurText from "./components/BlurText";
import { items } from "./data/items";

// Lazy load heavy components
const PDFViewer = dynamic(() => import("./components/PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-gray-400">Loading PDF...</span>
    </div>
  ),
});

export default function Home() {
  // Memoize items to prevent unnecessary re-renders
  const memoizedItems = useMemo(() => items, []);

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
      <main className="relative z-0 text-white p-8 flex flex-col items-center justify-center flex-1 gap-14">
        <ProfileCard
          name="Tom Arad"
          title="Software Engineer"
          handle="tom.arad.2001"
          status="Online"
          contactText="Linkedin"
          avatarUrl="/ME.png"
          showUserInfo={true}
          enableTilt={true}
          enableMobileTilt={false}
          onContactClick={() => {
            window.open("https://www.linkedin.com/in/tom-arad/", "_blank");
          }}
        />

        <BlurText
          text="My Projects"
          delay={150}
          animateBy="words"
          direction="top"
          className="text-4xl mb-8"
        />

        {/* Optimize grid container with better constraints */}
        <div className="relative w-full max-w-[98rem] overflow-hidden">
          <ChromaGrid
            items={memoizedItems}
            radius={gridConfig.radius}
            damping={gridConfig.damping}
            fadeOut={gridConfig.fadeOut}
            ease={gridConfig.ease}
          />
        </div>

        {/* Lazy load PDF with suspense boundary */}
        <Suspense
          fallback={
            <div className="w-full max-w-[800px] h-64 bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-400">Loading PDF viewer...</span>
            </div>
          }
        >
          <div className="w-full max-w-[800px] mx-auto">
            <PDFViewer fileUrl="TomArad-Resume.pdf" showToolbar={false} />
          </div>
        </Suspense>

        {/* Open in New Tab Button */}
        <button
          onClick={() =>
            window.open("/viewer?file=TomArad-Resume.pdf", "_blank")
          }
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors duration-200"
          aria-label="Open PDF in fullscreen"
        >
          Open PDF in Fullscreen
        </button>
      </main>
    </>
  );
}
