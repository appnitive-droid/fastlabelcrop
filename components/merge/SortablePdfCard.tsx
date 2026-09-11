"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PdfThumbnail from "../pdf/PdfThumbnail";
import { formatBytes, MAX_LIVE_THUMBNAIL_PAGES } from "@/lib/constants";

export interface MergeItem {
  id: string;
  file: File;
  data: Uint8Array;
  pageCount: number | null;
  thumbFailed?: boolean;
}

/**
 * Whole card is the drag handle (listeners on the root) so users can grab
 * the preview, header, or anywhere — not just the small grip icon.
 * The remove button stops propagation so it never starts a drag.
 * Touch scrolling still works: touch uses press-and-hold to drag
 * (see TouchSensor config in MergeFileList).
 */
export default function SortablePdfCard({
  item,
  index,
  onRemove,
}: {
  item: MergeItem;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title="Drag to reorder"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card group relative cursor-grab select-none overflow-hidden transition-shadow active:cursor-grabbing ${
        isDragging ? "z-20 shadow-pop ring-2 ring-accent-500" : "hover:shadow-pop"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400"
        >
          ⠿
        </span>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold tabular-nums text-white">
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800" title={item.file.name}>
          {item.file.name}
        </p>
        <button
          onClick={() => onRemove(item.id)}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          title="Remove file"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          ✕
        </button>
      </div>
      <div className="relative aspect-[3/4] max-h-64 w-full overflow-hidden bg-slate-100">
        <PdfThumbnail
          data={item.data}
          alt={item.file.name}
          className="h-full w-full pointer-events-none"
        />
        {item.pageCount !== null && item.pageCount > MAX_LIVE_THUMBNAIL_PAGES && (
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white">
            {item.pageCount} pages
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-[12px] text-slate-500">
        <span className="font-medium">{formatBytes(item.file.size)}</span>
        <span className="font-semibold tabular-nums">
          {item.pageCount === null ? "…" : `${item.pageCount} page${item.pageCount === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
