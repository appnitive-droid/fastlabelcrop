"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderPageToCanvas, RenderCancelled } from "@/lib/pdf/render";

function friendlyRenderError(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function RetryBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      <p className="font-bold">Preview couldn&apos;t render</p>
      <p className="mt-0.5 opacity-90">{message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={onRetry}
          className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100"
        >
          Retry preview
        </button>
        <span className="text-[12px] opacity-75">
          Your file itself is fine — downloading still works.
        </span>
      </div>
    </div>
  );
}

/** Large single-page preview (used in crop upload + crop editor background). */
export function PdfPreviewCanvas({
  data,
  maxWidth = 640,
  renderScale = 1.8,
  onSized,
}: {
  data: Uint8Array;
  maxWidth?: number;
  renderScale?: number;
  onSized?: (size: { width: number; height: number; numPages: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    setError(null);
    setAttempt(0);
  }, [data]);

  const render = useCallback(async () => {
    if (!canvasRef.current) return;
    const mySeq = ++seqRef.current;
    const isStale = () => seqRef.current !== mySeq;
    setLoading(true);
    setError(null);
    try {
      const info = await renderPageToCanvas({
        data,
        pageNumber: 1,
        canvas: canvasRef.current,
        scale: renderScale,
        maxWidth,
        isStale,
      });
      onSized?.(info);
    } catch (e) {
      if (e instanceof RenderCancelled) return; // superseded — stay silent
      setError(friendlyRenderError(e, "Could not render this PDF preview."));
    } finally {
      if (!isStale()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxWidth, renderScale, attempt]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="relative">
      {error && <RetryBanner message={error} onRetry={() => setAttempt((a) => a + 1)} />}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
            Rendering preview…
          </span>
        </div>
      )}
      {/* Canvas stays mounted (hidden on error) so retry always has a render target. */}
      <canvas
        ref={canvasRef}
        className={`mx-auto block max-w-full rounded-lg shadow-pop ${error ? "hidden" : ""}`}
      />
    </div>
  );
}

/** Multi-page result viewer with navigation. Renders from real output bytes. */
export default function PdfViewer({
  data,
  title = "PDF Preview",
}: {
  data: Uint8Array;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    setPage(1);
    setNumPages(1);
    setError(null);
    setAttempt(0);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const mySeq = ++seqRef.current;
    const isStale = () => cancelled || seqRef.current !== mySeq;
    async function run() {
      if (!canvasRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const info = await renderPageToCanvas({
          data,
          pageNumber: page,
          canvas: canvasRef.current,
          scale: 1.6,
          maxWidth: 620,
          isStale,
        });
        if (!cancelled) setNumPages(info.numPages);
      } catch (e) {
        if (e instanceof RenderCancelled) return; // superseded — stay silent
        if (!cancelled)
          setError(friendlyRenderError(e, "Could not render this page."));
      } finally {
        if (!isStale()) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [data, page, attempt]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="min-w-[86px] text-center text-[13px] font-medium tabular-nums text-slate-500">
            Page {page} / {numPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages || loading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
      {error && <RetryBanner message={error} onRetry={() => setAttempt((a) => a + 1)} />}
      <div className="relative overflow-auto rounded-xl border border-slate-200 bg-slate-100/70 p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
              Rendering page {page}…
            </span>
          </div>
        )}
        {/* Canvas stays mounted (hidden on error) so retry / page nav always has a render target. */}
        <canvas
          ref={canvasRef}
          className={`mx-auto block max-w-full rounded-lg bg-white shadow-pop ${error ? "hidden" : ""}`}
        />
      </div>
    </div>
  );
}
