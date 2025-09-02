"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const PDFViewer = dynamic(() => import("./PDFViewer"), {
  ssr: false,
});

export default function PDFViewerClient() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("file");

  if (!fileUrl) {
    return <div>No file specified.</div>;
  }

  return (
    <div className="w-screen h-screen">
      <PDFViewer fileUrl={fileUrl} hideFullscreenButton />
    </div>
  );
}
