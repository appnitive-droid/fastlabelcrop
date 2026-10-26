"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CropRectangle from "./CropRectangle";
import CropControls from "./CropControls";
import { clampRect, type CropRect } from "@/lib/pdf/platform-defaults";
import { renderPageToCanvas, RenderCancelled } from "@/lib/pdf/render";

interface Props {
  data: Uint8Array;
  fileName: string;
  initialRect: CropRect;
  busy: boolean;
  onCrop: (rect: CropRect) => void;
  onResetSignal?: number;
  actionLabel?: string;
}

export default function CropEditor({ data, initialRect, busy, onCrop, actionLabel }: Props) {
  const [rect, setRect] = useState<CropRect>(() => clampRect(initialRect));
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 560, height: 760 });
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    setRect(clampRect(initialRect));
  }, [initialRect, data]);

  const doRender = useCallback(async (signal: AbortSignal) => {
    if (!canvasRef.current) return;
    const mySeq = ++seqRef.current;
    const isStale = () => signal.aborted || seqRef.current !== mySeq;
    setRendering(true);
    setRenderError(null);
    try {
      const info = await renderPageToCanvas({
        data,
        pageNumber: 1,
        canvas: canvasRef.current,
        scale: 1.9,
        maxWidth: 620,
        isStale,
        signal,
      });
      if (isStale()) return;
      setPageSize({ width: info.width, height: info.height });
    } catch (e) {
      if (isStale() || e instanceof RenderCancelled) return; // superseded — stay silent
      setRenderError(
        e instanceof Error ? e.message : "Could not render the preview for this PDF."
      );
    } finally {
      if (!isStale()) setRendering(false);
    }
  }, [data, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    doRender(controller.signal);
    return () => controller.abort();
  }, [doRender]);

  const displayW = Math.round(pageSize.width * zoom);
  const displayH = Math.round(pageSize.height * zoom);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Preview column */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[13px] font-semibold text-slate-700">
            Page 1 preview <span className="font-normal text-slate-400">· crop applies to all pages</span>
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">
            {Math.round(rect.width * 100)}% × {Math.round(rect.height * 100)}%
          </span>
        </div>
        <div className="max-h-[72vh] overflow-auto bg-slate-100/80 p-4 sm:p-6">
          <div className="mx-auto w-fit">
            {renderError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-6 text-sm font-medium text-rose-700" role="alert">
                <p>{renderError}</p>
                <button className="mt-3 rounded-lg bg-white px-3 py-2 font-bold" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button>
              </div>
            )}
              <div
                className={`relative overflow-hidden rounded-lg bg-white shadow-pop ${renderError ? "hidden" : ""}`}
                style={{ width: displayW, height: displayH, maxWidth: "none" }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: displayW, height: displayH }}
                  className="block max-w-none"
                />
                {!rendering && <CropRectangle rect={rect} onChange={setRect} />}
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-500">
                    Rendering…
                  </div>
                )}
              </div>
            <p className="mt-3 text-center text-[12px] text-slate-400">
              Drag to move · drag corners / edges to resize
            </p>
          </div>
        </div>
      </div>

      {/* Settings column */}
      <div className="card h-fit p-5 lg:sticky lg:top-32">
        <CropControls
          rect={rect}
          onChange={(r) => setRect(clampRect(r))}
          zoom={zoom}
          onZoom={setZoom}
          onReset={() => setRect(clampRect(initialRect))}
          onCrop={() => onCrop(clampRect(rect))}
          busy={busy}
          disabled={rendering || Boolean(renderError)}
          actionLabel={actionLabel}
        />
      </div>
    </div>
  );
}
