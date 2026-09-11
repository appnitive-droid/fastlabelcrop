"use client";

import { useRef } from "react";
import type { CropRect } from "@/lib/pdf/platform-defaults";
import { clampRect } from "@/lib/pdf/platform-defaults";

type Handle =
  | "move"
  | "nw" | "ne" | "sw" | "se"
  | "n" | "s" | "e" | "w";

const HANDLE_CURSORS: Record<Handle, string> = {
  move: "cursor-move",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  ne: "cursor-nesw-resize",
  sw: "cursor-nesw-resize",
  n: "cursor-ns-resize",
  s: "cursor-ns-resize",
  e: "cursor-ew-resize",
  w: "cursor-ew-resize",
};

/**
 * Interactive crop rectangle overlay. Positioned in % over the preview.
 * Draggable + resizable via 8 handles. Dims everything outside via box-shadow.
 */
export default function CropRectangle({
  rect,
  onChange,
}: {
  rect: CropRect;
  onChange: (r: CropRect) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; orig: CropRect; W: number; H: number } | null>(null);

  function startDrag(e: React.PointerEvent, handle: Handle) {
    e.preventDefault();
    e.stopPropagation();
    const container = boxRef.current?.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...rect },
      W: bounds.width,
      H: bounds.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) / d.W;
      const dy = (ev.clientY - d.startY) / d.H;
      const o = d.orig;
      let next: CropRect = { ...o };
      const min = 0.03;
      if (d.handle === "move") {
        next.x = Math.min(1 - o.width, Math.max(0, o.x + dx));
        next.y = Math.min(1 - o.height, Math.max(0, o.y + dy));
      } else {
        if (d.handle.includes("w")) {
          const nx = Math.min(o.x + o.width - min, Math.max(0, o.x + dx));
          next.width = o.width + (o.x - nx);
          next.x = nx;
        }
        if (d.handle.includes("e")) {
          next.width = Math.max(min, Math.min(1 - o.x, o.width + dx));
        }
        if (d.handle.includes("n")) {
          const ny = Math.min(o.y + o.height - min, Math.max(0, o.y + dy));
          next.height = o.height + (o.y - ny);
          next.y = ny;
        }
        if (d.handle.includes("s")) {
          next.height = Math.max(min, Math.min(1 - o.y, o.height + dy));
        }
      }
      onChange(clampRect(next));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const handles: { id: Handle; cls: string }[] = [
    { id: "nw", cls: "-left-[7px] -top-[7px]" },
    { id: "ne", cls: "-right-[7px] -top-[7px]" },
    { id: "sw", cls: "-bottom-[7px] -left-[7px]" },
    { id: "se", cls: "-bottom-[7px] -right-[7px]" },
    { id: "n", cls: "left-1/2 -top-[7px] -translate-x-1/2" },
    { id: "s", cls: "bottom-[-7px] left-1/2 -translate-x-1/2" },
    { id: "w", cls: "-left-[7px] top-1/2 -translate-y-1/2" },
    { id: "e", cls: "-right-[7px] top-1/2 -translate-y-1/2" },
  ];

  return (
    <div
      ref={boxRef}
      onPointerDown={(e) => startDrag(e, "move")}
      className={`absolute touch-none select-none rounded-[3px] border-2 border-accent-500 ${HANDLE_CURSORS.move}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
        boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
      }}
    >
      {/* grid thirds */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-white/60" />
        ))}
      </div>
      {handles.map((h) => (
        <span
          key={h.id}
          onPointerDown={(e) => startDrag(e, h.id)}
          className={`absolute z-10 h-3.5 w-3.5 rounded-[5px] border-2 border-accent-600 bg-white shadow ${h.cls} ${HANDLE_CURSORS[h.id]} touch-none`}
        />
      ))}
    </div>
  );
}
