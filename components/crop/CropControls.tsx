"use client";

import type { CropRect } from "@/lib/pdf/platform-defaults";

function NumField({
  label,
  valuePct,
  onCommit,
}: {
  label: string;
  valuePct: number;
  onCommit: (pct: number) => void;
}) {
  return (
    <label className="block">
      <span className="label-xs">{label} %</span>
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={Number(valuePct.toFixed(1))}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onCommit(Math.min(100, Math.max(0, v)));
        }}
        className="input-num mt-1 tabular-nums"
      />
    </label>
  );
}

export default function CropControls({
  rect,
  onChange,
  zoom,
  onZoom,
  onReset,
  onCrop,
  busy,
}: {
  rect: CropRect;
  onChange: (r: CropRect) => void;
  zoom: number;
  onZoom: (z: number) => void;
  onReset: () => void;
  onCrop: () => void;
  busy: boolean;
}) {
  const set = (patch: Partial<CropRect>) =>
    onChange({
      ...rect,
      ...Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, (v as number) / 100])
      ) as Partial<CropRect>,
    });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-bold text-slate-900">Crop area</p>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Drag the box on the preview, pull a handle, or type exact values. Applies to every page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="X" valuePct={rect.x * 100} onCommit={(v) => set({ x: v })} />
        <NumField label="Y" valuePct={rect.y * 100} onCommit={(v) => set({ y: v })} />
        <NumField label="Width" valuePct={rect.width * 100} onCommit={(v) => set({ width: Math.max(2, v) })} />
        <NumField label="Height" valuePct={rect.height * 100} onCommit={(v) => set({ height: Math.max(2, v) })} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="label-xs">Preview zoom</span>
          <span className="text-[13px] font-semibold tabular-nums text-slate-700">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => onZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50"
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            min={50}
            max={250}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(e) => onZoom(Number(e.target.value) / 100)}
            className="flex-1 accent-blue-600"
          />
          <button
            onClick={() => onZoom(Math.min(2.5, +(zoom + 0.25).toFixed(2)))}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50"
            aria-label="Zoom in"
          >
            ＋
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-600">
        Output keeps full vector quality — we tighten the PDF boxes, never rasterize to images.
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onCrop}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-accent-700 active:scale-[0.99] disabled:opacity-60"
        >
          {busy && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {busy ? "Cropping your PDF…" : "Crop PDF"}
        </button>
        <button
          onClick={onReset}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset Crop
        </button>
      </div>
    </div>
  );
}
