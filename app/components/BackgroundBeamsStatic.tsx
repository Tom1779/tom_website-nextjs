"use client";
import React from "react";
import { cn } from "@/lib/utils";

export const BackgroundBeamsStatic = React.memo(
  ({ className }: { className?: string }) => {
    return (
      <div
        className={cn("absolute inset-0 overflow-hidden", className)}
        style={
          {
            "--color-1": "#10b981",
            "--color-2": "#34d399",
            "--color-3": "#6ee7b7",
            "--color-4": "#2dd4bf",
            "--color-5": "#14b8a6",
            "--black": "#000",
            "--white": "#fff",
            "--transparent": "transparent",
            "--animation-speed": "100s",
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "pointer-events-none absolute -inset-[10px]",
            "[background-image:repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%),repeating-linear-gradient(100deg,var(--color-1)_10%,var(--color-2)_15%,var(--color-3)_20%,var(--color-4)_25%,var(--color-5)_30%)]",
            "[background-size:300%,_200%] [background-position:50%_50%,50%_50%]",
            "opacity-20 blur-[40px]",
            "after:absolute after:inset-0",
            "after:[background-image:repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%),repeating-linear-gradient(100deg,var(--color-1)_10%,var(--color-2)_15%,var(--color-3)_20%,var(--color-4)_25%,var(--color-5)_30%)]",
            "after:[background-size:200%,_100%]",
            "after:[background-attachment:fixed]",
            "after:mix-blend-difference after:content-['']",
            "after:[animation:aurora_var(--animation-speed)_linear_infinite]",
            "[mask-image:radial-gradient(ellipse_at_50%_0%,black_10%,transparent_70%)]"
          )}
        />
      </div>
    );
  }
);

BackgroundBeamsStatic.displayName = "BackgroundBeamsStatic";