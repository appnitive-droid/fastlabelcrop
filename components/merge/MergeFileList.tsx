"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { useState } from "react";
import SortablePdfCard, { type MergeItem } from "./SortablePdfCard";
import PdfThumbnail from "../pdf/PdfThumbnail";

export default function MergeFileList({
  items,
  onReorder,
  onRemove,
}: {
  items: MergeItem[];
  onReorder: (items: MergeItem[]) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold to drag on touch so swipe-to-scroll keeps working.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((i) => i.id === activeId) || null;

  function handleStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, idx) => (
            <SortablePdfCard key={item.id} item={item} index={idx} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
        }}
      >
        {active ? (
          <div className="card w-48 rotate-2 overflow-hidden opacity-95 shadow-pop ring-2 ring-accent-500">
            <div className="aspect-[3/4] bg-slate-100">
              <PdfThumbnail data={active.data} alt={active.file.name} className="h-full w-full" />
            </div>
            <p className="truncate px-3 py-2 text-[12px] font-semibold">{active.file.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
