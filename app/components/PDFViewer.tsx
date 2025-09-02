"use client";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { useEffect } from "react";

interface PDFViewerProps {
  fileUrl: string;
  defaultZoom?: number;
  hideFullscreenButton?: boolean;
  showToolbar?: boolean;
}

export default function PDFViewer({
  fileUrl,
  defaultZoom = 1.0,
  hideFullscreenButton = false,
  showToolbar = true,
}: PDFViewerProps) {
  const plugin = defaultLayoutPlugin(); // always call at top level

  useEffect(() => {
    if (hideFullscreenButton && showToolbar) {
      const style = document.createElement("style");
      style.innerHTML = `
        button[aria-label="Full screen"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [hideFullscreenButton, showToolbar]);

  return (
    <div className="w-full h-full">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={fileUrl}
          plugins={showToolbar ? [plugin] : []}
          defaultScale={defaultZoom}
        />
      </Worker>
    </div>
  );
}
