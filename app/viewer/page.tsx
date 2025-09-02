import { Suspense } from "react";
import PDFViewerClient from "../components/PDFViewerClient";

export default function ViewerPage() {
  return (
    <Suspense fallback={<div>Loading PDF...</div>}>
      <PDFViewerClient />
    </Suspense>
  );
}
