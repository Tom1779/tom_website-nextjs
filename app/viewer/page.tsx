"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// Instead of top-level import
const PDFViewer = dynamic(
  async () => {
    const { default: PDFViewerClient } = await import(
      "../components/PDFViewer"
    );
    return PDFViewerClient;
  },
  { ssr: false }
);

export default function ViewerPage() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("file");

  if (!fileUrl) return <div>No file specified</div>;

  return (
    <div className="w-screen h-screen">
      <PDFViewer fileUrl={fileUrl} hideFullscreenButton />
    </div>
  );
}
