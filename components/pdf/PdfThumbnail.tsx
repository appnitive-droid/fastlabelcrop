"use client";

import { useEffect, useState } from "react";
import { renderThumbnail } from "@/lib/pdf/render";

/** Small first-page thumbnail rendered from real PDF bytes. Never a generic icon. */
export default function PdfThumbnail({
  data,
  alt,
  width = 220,
  className = "",
}: {
  data: Uint8Array;
  alt: string;
  width?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    renderThumbnail(data, width)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [data, width]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-center text-[12px] font-medium text-slate-500 ${className}`}
      >
        <span className="px-3">Preview unavailable</span>
      </div>
    );
  }
  if (!src) {
    return (
      <div className={`animate-pulse bg-slate-100 ${className}`}>
        <span className="sr-only">Loading preview…</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`bg-white object-contain ${className}`} draggable={false} />;
}
