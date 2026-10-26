"use client";

import { useMemo, useRef, useState } from "react";
import Link from "@/components/ui/AppLink";
import PdfResult from "@/components/pdf/PdfResult";
import PdfUploader from "@/components/pdf/PdfUploader";
import MergeFileList from "@/components/merge/MergeFileList";
import type { MergeItem } from "@/components/merge/SortablePdfCard";
import ProgressBar from "@/components/ui/ProgressBar";
import Button from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/primitives";
import { MAX_FILE_SIZE_BYTES, MAX_MERGE_FILES } from "@/lib/constants";
import { fileToBytes, uid, validatePdfFile } from "@/lib/file";
import { yieldForPaint } from "@/lib/yield-for-paint";
import { useOperationGate } from "@/lib/use-operation-gate";

type Stage = "select" | "result";

interface Props {
  initialItems?: MergeItem[];
  onItemsChange?: (items: MergeItem[]) => void;
  onBack?: () => void;
}

export default function MergeWorkspace({ initialItems = [], onItemsChange, onBack }: Props) {
  const [items, setItems] = useState<MergeItem[]>(initialItems);
  const gate = useOperationGate();
  const advanced = Boolean(onBack);

  function updateItems(next: MergeItem[] | ((prev: MergeItem[]) => MergeItem[])) {
    // Notify the parent outside React's state updater (StrictMode may replay it).
    const updated = typeof next === "function" ? next(items) : next;
    setItems(updated);
    onItemsChange?.(updated);
  }
  const [stage, setStage] = useState<Stage>("select");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadBatch, setUploadBatch] = useState({ completed: 0, total: 0 });
  const [uploadProgress, setUploadProgress] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalPages = useMemo(
    () => items.reduce((s, i) => s + (i.pageCount || 0), 0),
    [items]
  );

  async function handleFiles(files: File[]) {
    const token = gate.begin();
    if (token === null) return;
    setError(null);
    if (items.length + files.length > MAX_MERGE_FILES) {
      setError(`You can merge up to ${MAX_MERGE_FILES} PDFs at once. Remove some files or merge in batches.`);
      files = files.slice(0, MAX_MERGE_FILES - items.length);
      if (files.length === 0) { gate.finish(token); return; }
    }
    setUploadBatch({ completed: 0, total: files.length });
    setAdding(true);
    setUploadProgress("Reading PDF…");
    await yieldForPaint();
    if (!gate.isCurrent(token)) return;
    const next: MergeItem[] = [];
    for (let index = 0; index < files.length; index++) {
      const f = files[index];
      if (!gate.isCurrent(token)) return;
      try {
        setUploadProgress(`Reading PDF… (${index + 1}/${files.length}): ${f.name}`);
        await yieldForPaint();
        if (!gate.isCurrent(token)) return;
        const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
        if (problem) {
          setError(problem);
          continue;
        }
        try {
          const bytes = await fileToBytes(f);
          if (!gate.isCurrent(token)) return;
          let pages: number | null = null;
          try {
            // Validate with pdf-lib (no worker needed) so a preview-engine
            // hiccup can never block a valid upload. Thumbnails render
            // separately and fail soft per-card.
            const { PDFDocument } = await import("pdf-lib");
            if (!gate.isCurrent(token)) return;
            const doc = await PDFDocument.load(bytes);
            if (!gate.isCurrent(token)) return;
            pages = doc.getPageCount();
            if (pages < 1) throw new Error("empty");
          } catch (err) {
            if (!gate.isCurrent(token)) return;
            console.error("[merge] upload validation failed:", err);
            setError(`"${f.name}" could not be opened. It may be corrupted or password-protected — skipped.`);
            continue;
          }
          next.push({ id: uid(), file: f, data: bytes, pageCount: pages });
        } catch {
          if (!gate.isCurrent(token)) return;
          setError(`Could not read "${f.name}". It was skipped.`);
        }
      } finally {
        if (gate.isCurrent(token)) setUploadBatch({ completed: index + 1, total: files.length });
      }
    }
    if (!gate.isCurrent(token)) return;
    if (next.length) {
      updateItems((prev) => [...prev, ...next]);
      setStage("select");
      setResult(null);
    }
    setAdding(false);
    setUploadBatch({ completed: 0, total: 0 });
    setUploadProgress("");
    gate.finish(token);
  }

  async function handleMerge() {
    setError(null);
    if (items.length < (advanced ? 1 : 2)) {
      setError("Select at least 2 PDFs to merge.");
      return;
    }
    const token = gate.begin();
    if (token === null) return;
    setBusy(true);
    try {
      await yieldForPaint();
      if (!gate.isCurrent(token)) return;
      const { mergePdfs } = await import("@/lib/pdf/merge");
      if (!gate.isCurrent(token)) return;
      const out = items.length === 1 ? items[0].data : await mergePdfs(items.map((i) => i.data));
      if (!gate.isCurrent(token)) return;
      setResult(out);
      setStage("result");
    } catch (e) {
      if (gate.isCurrent(token)) setError(e instanceof Error ? e.message : "Merging failed. Please retry.");
    } finally {
      if (gate.isCurrent(token)) { setBusy(false); gate.finish(token); }
    }
  }

  function cancelUpload() {
    gate.invalidate();
    setAdding(false);
    setUploadBatch({ completed: 0, total: 0 });
    setUploadProgress("");
  }

  function resetAll() {
    gate.invalidate();
    setAdding(false);
    setUploadBatch({ completed: 0, total: 0 });
    setUploadProgress("");
    setBusy(false);
    updateItems([]);
    setResult(null);
    setError(null);
    setStage("select");
  }

  return (
    <div className="pb-28">
      <div className="animate-fadeIn">
        {onBack && <Button variant="secondary" className="mb-5" disabled={busy} onClick={() => { gate.invalidate(); onBack(); }}>← Back to crop settings</Button>}
        {advanced && stage === "select" && <div className="mb-5">
          <h2 className="text-xl font-bold">2. Arrange &amp; merge</h2>
          <p className="mt-1 text-sm text-slate-500">Drag PDFs into the order you want. Pages within each PDF stay in their original order.</p>
        </div>}
        {error && (
          <div className="mb-5">
            <Alert title="Something needs attention" message={error} />
          </div>
        )}

        {stage === "select" && (
          <>
            {adding && <div className="card mb-5 flex items-start justify-between gap-3 p-4" role="status">
              <ProgressBar label={uploadProgress || "Reading PDF…"}
                value={uploadBatch.total > 1 ? uploadBatch.completed / uploadBatch.total * 100 : undefined}
                detail={uploadBatch.total > 1 ? `${uploadBatch.completed} of ${uploadBatch.total} files processed` : undefined} />
              <Button variant="secondary" size="sm" onClick={cancelUpload}>Cancel</Button>
            </div>}
            {items.length === 0 ? (advanced ? <p className="card p-6">No PDFs selected. Go back to crop settings to add files.</p> : (
              <div className="mx-auto max-w-2xl">
                <PdfUploader multiple disabled={adding}
                  title="Drop your PDFs here" hint="First-page thumbnails appear after upload"
                  cta="Choose PDF Files" onFiles={handleFiles} />
              </div>
            )) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    <span className="font-bold text-slate-900">{items.length} file{items.length === 1 ? "" : "s"}</span>
                    {" · "}
                    {totalPages} page{totalPages === 1 ? "" : "s"} total · drag a card to
                    reorder — merge follows this order
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const fs = Array.from(e.target.files || []);
                        if (fs.length) handleFiles(fs);
                        e.target.value = "";
                      }}
                    />
                    {!advanced && <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={adding || busy}>
                      {adding ? "Adding…" : "+ Add more"}
                    </Button>}
                    <Button variant="ghost" size="sm" disabled={busy} onClick={resetAll}>
                      Clear all
                    </Button>
                  </div>
                </div>

                <MergeFileList
                  disabled={busy || adding}
                  items={items}
                  onReorder={updateItems}
                  onRemove={(id) => updateItems((prev) => prev.filter((i) => i.id !== id))}
                />

                {busy && (
                  <div className="card mt-5 flex items-center justify-center gap-3 border-accent-200 bg-accent-50 px-4 py-3.5">
                    <Spinner label="Merging your PDFs…" />
                  </div>
                )}
              </>
            )}

            <div className="mt-6">
              <Link href="/" className="text-[13px] font-semibold text-slate-500 hover:text-slate-800">
                ← Back to Dashboard
              </Link>
            </div>
          </>
        )}

        {stage === "result" && result && <PdfResult data={result}
          filename={items.length === 1 ? items[0].file.name : "merged.pdf"}
          showPreview={false}
          actions={<>
            <Button variant="secondary" size="lg" onClick={advanced ? () => { setResult(null); setStage("select"); } : resetAll}>
              {advanced ? "Arrange again" : "Merge More PDFs"}
            </Button>
            <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Back to Dashboard</Link>
          </>} />}
      </div>

      {/* Sticky merge bar */}
      {stage === "select" && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur">
          <div className="container-x flex flex-col items-center justify-between gap-2 py-3 sm:flex-row">
            <p className="text-[13px] text-slate-500">
              {items.length < 2 && !advanced ? (
                <>Add at least <b>one more PDF</b> to enable merging.</>
              ) : (
                <>Ready — pages will be combined in the order shown above.</>
              )}
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto sm:min-w-56"
              disabled={items.length < (advanced ? 1 : 2) || busy || adding}
              loading={busy}
              onClick={handleMerge}
            >
              {busy ? "Preparing your PDF…" : advanced && items.length === 1 ? "Continue to Download" : `Merge ${items.length} PDF${items.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
