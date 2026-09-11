"use client";

import { useRef, useState } from "react";
import Button from "../ui/Button";

interface Props {
  multiple?: boolean;
  compact?: boolean;
  title?: string;
  hint?: string;
  cta?: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export default function PdfUploader({
  multiple = false,
  title = "Drop your PDF here",
  hint = "or browse from your device",
  cta = "Choose PDF",
  onFiles,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) onFiles(files);
      }}
      className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all sm:py-16 ${
        dragging
          ? "border-accent-500 bg-accent-50 scale-[1.01]"
          : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-card transition-transform group-hover:scale-105 ${
          dragging ? "bg-accent-600 text-white" : "bg-slate-900 text-white"
        }`}
      >
        {multiple ? "⧉" : "＋"}
      </div>
      <p className="text-[17px] font-bold tracking-tight text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">
        {hint} · {multiple ? "You can select multiple files." : "Single PDF up to 25 MB."}
      </p>
      <Button
        type="button"
        variant="primary"
        className="mt-5"
        onClick={() => inputRef.current?.click()}
      >
        {cta}
      </Button>
      <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
        🔒 Processed locally — never uploaded to a server
      </p>
    </div>
  );
}
