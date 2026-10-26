"use client";

import { useEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Button from "../ui/Button";
import { Spinner } from "../ui/primitives";
import { downloadBytes } from "@/lib/file";
import { formatBytes } from "@/lib/constants";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <Spinner label="Loading preview…" />,
});

/** Actions precede a fixed-height preview so rendering never moves Download. */
export default function PdfResult({
  data, filename, actions, warning, showPreview = true,
}: {
  data: Uint8Array;
  filename: string;
  actions?: ReactNode;
  warning?: ReactNode;
  showPreview?: boolean;
}) {
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const result = resultRef.current;
      if (!result) return;
      const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: Math.max(0, window.scrollY + result.getBoundingClientRect().top - headerHeight - 16), behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div ref={resultRef} className="card mx-auto max-w-3xl p-5 sm:p-7">
    <p className="break-all text-sm font-bold text-slate-900">{filename}</p>
    <p className="mt-1 text-[13px] text-slate-500">{formatBytes(data.length)}</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button size="lg" onClick={() => downloadBytes(data, filename)}>⬇ Download PDF</Button>
      {actions}
    </div>
    {warning && <div className="mt-4">{warning}</div>}
    {showPreview && <div className="mt-5 h-[60vh] min-h-64 max-h-[720px] overflow-auto overscroll-contain rounded-xl" aria-label="PDF preview area" tabIndex={0}>
      <PdfViewer data={data} title="PDF Preview" />
    </div>}
  </div>;
}
