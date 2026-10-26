"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PlatformChoices from "./PlatformChoices";
import { detectPdfPlatform } from "@/lib/pdf/detect-platform";
import InvoiceOptions from "./InvoiceOptions";
import PdfUploader from "../pdf/PdfUploader";
import ProgressBar from "../ui/ProgressBar";
import Button from "../ui/Button";
import { Alert, Spinner } from "../ui/primitives";
import type { MergeItem } from "../merge/SortablePdfCard";
import { MAX_FILE_SIZE_BYTES, MAX_MERGE_FILES, formatBytes } from "@/lib/constants";
import { fileToBytes, uid, validatePdfFile } from "@/lib/file";
import { PLATFORM_DEFAULTS, type CropRect } from "@/lib/pdf/platform-defaults";
import { canProcess, changeAdvancedSettings, keepOriginal, needsCropReview, processAdvancedItem, type AdvancedItem } from "@/lib/pdf/advanced";
import { yieldForPaint } from "@/lib/yield-for-paint";
import { useOperationGate } from "@/lib/use-operation-gate";

const CropEditor = dynamic(() => import("./CropEditor"), { ssr: false, loading: () => <Spinner label="Loading crop editor…" /> });
const MergeWorkspace = dynamic(() => import("../merge/MergeWorkspace"), { ssr: false, loading: () => <Spinner label="Loading merge workspace…" /> });

export default function AdvancedFlow() {
  const [items, setItems] = useState<AdvancedItem[]>([]);
  const [stage, setStage] = useState<"setup" | "merge">("setup");
  const [mergeItems, setMergeItems] = useState<MergeItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadBatch, setUploadBatch] = useState({ completed: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const gate = useOperationGate();
  useEffect(() => () => controller.current?.abort(), []);

  function cancel() {
    gate.invalidate();
    controller.current?.abort();
    setAdding(false);
    setUploadBatch({ completed: 0, total: 0 });
    setBusy(false);
    setProgress("");
    setItems((prev) => prev.map((i) => i.status === "processing" ? { ...i, status: "pending" } : i));
  }

  function reset() {
    cancel();
    setItems([]);
    setMergeItems([]);
    setEditing(null);
    setError(null);
  }

  function changeSettings(id: string, patch: Partial<AdvancedItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? changeAdvancedSettings(i, patch) : i));
  }

  async function upload(files: File[]) {
    const token = gate.begin();
    if (token === null) return;
    const abort = new AbortController();
    controller.current = abort;
    setUploadBatch({ completed: 0, total: Math.min(files.length, MAX_MERGE_FILES - items.length) });
    setAdding(true);
    setProgress("Reading PDF…");
    setError(null);
    const problems: string[] = [];
    const available = MAX_MERGE_FILES - items.length;
    if (files.length > available) problems.push(`You can crop up to ${MAX_MERGE_FILES} PDFs at once. Extra files were skipped.`);
    try {
      await yieldForPaint();
      if (!gate.isCurrent(token)) return;
      const { PDFDocument } = await import("pdf-lib");
      const selectedFiles = files.slice(0, available);
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        if (!gate.isCurrent(token)) return;
        try {
          setProgress(`Reading PDF… (${index + 1}/${selectedFiles.length}): ${file.name}`);
          await yieldForPaint();
          if (!gate.isCurrent(token)) return;
          const problem = validatePdfFile(file, MAX_FILE_SIZE_BYTES);
          if (problem) { problems.push(problem); continue; }
          try {
            const data = await fileToBytes(file);
            if (!gate.isCurrent(token)) return;
            let pageCount = 0;
            let warning: string | undefined;
            try {
              const doc = await PDFDocument.load(data);
              pageCount = doc.getPageCount();
              if (!pageCount) throw new Error("Empty PDF");
            } catch {
              warning = "This PDF could not be opened. Retry after choosing a marketplace, or remove it and upload an unlocked, valid PDF.";
            }
            if (!gate.isCurrent(token)) return;
            setProgress(`Detecting platform… (${index + 1}/${selectedFiles.length}): ${file.name}`);
            await yieldForPaint();
            if (!gate.isCurrent(token)) return;
            const detection = pageCount > 0 ? await detectPdfPlatform(data, abort.signal) : undefined;
            if (!gate.isCurrent(token)) return;
            let item: AdvancedItem = {
              id: uid(), file, data, platform: "", keepInvoices: false, rect: null,
              reviewed: false, manualOverride: false, readable: pageCount > 0,
              pageCount, status: warning ? "attention" : "pending", output: null, warning, detection,
            };
            if (detection?.platform) {
              item = { ...changeAdvancedSettings(item, { platform: detection.platform }), warning, status: warning ? "attention" : "pending" };
            }
            setItems((prev) => [...prev, item]);
          } catch { problems.push(`Could not read "${file.name}". Please upload it again.`); }
        } finally {
          if (gate.isCurrent(token)) setUploadBatch({ completed: index + 1, total: selectedFiles.length });
        }
      }
      if (!gate.isCurrent(token)) return;
      setError(problems.length ? problems.join(" ") : null);
    } catch {
      if (gate.isCurrent(token)) setError("Could not load the PDF tools. Please retry.");
    } finally {
      if (gate.isCurrent(token)) { setAdding(false); setUploadBatch({ completed: 0, total: 0 }); setProgress(""); gate.finish(token); }
    }
  }

  function arrange(ready: AdvancedItem[]) {
    setMergeItems(ready.map((i) => ({
      id: i.id, data: i.output!, pageCount: i.outputPages ?? i.pageCount,
      file: new File([i.output! as BlobPart], i.outputName || i.file.name, { type: "application/pdf" }),
    })));
    setStage("merge");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function processBatch(onlyId?: string) {
    const targets = items.filter((i) => onlyId ? i.id === onlyId : i.status !== "ready");
    if (!items.length || targets.some((i) => !canProcess(i))) return;
    const token = gate.begin();
    if (token === null) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError(null);
    let next = [...items];
    try {
      for (let index = 0; index < targets.length; index++) {
        if (!gate.isCurrent(token)) return;
        const item = targets[index];
        setProgress(`Cropping ${index + 1} of ${targets.length}: ${item.file.name}`);
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "processing" } : i));
        await yieldForPaint();
        if (!gate.isCurrent(token)) return;
        let processed: AdvancedItem;
        try {
          processed = await processAdvancedItem(item, abort.signal);
        } catch (e) {
          if (!gate.isCurrent(token)) return;
          processed = { ...item, status: "attention", output: null, warning: e instanceof Error ? e.message : "Could not crop this PDF. Please retry." };
        }
        if (!gate.isCurrent(token)) return;
        next = next.map((i) => i.id === item.id ? processed : i);
        setItems(next);
      }
      if (next.length && next.every((i) => i.status === "ready")) arrange(next);
    } finally {
      if (gate.isCurrent(token)) { setBusy(false); setProgress(""); gate.finish(token); }
    }
  }

  const editorItem = items.find((i) => i.id === editing);
  const locked = adding || busy;
  const allReady = items.length > 0 && items.every((i) => i.status === "ready");
  const canCrop = items.length > 0 && items.every((i) => i.status === "ready" || canProcess(i));

  if (stage === "merge") return <MergeWorkspace
    initialItems={mergeItems}
    onItemsChange={(next) => {
      setMergeItems(next);
      setItems((prev) => next.flatMap((m) => { const item = prev.find((i) => i.id === m.id); return item ? [item] : []; }));
    }}
    onBack={() => setStage("setup")}
  />;

  if (editorItem) return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="break-all text-lg font-bold">Review crop: {editorItem.file.name}</h2><p className="text-sm text-slate-500">This selection applies to every page of this PDF.</p></div>
      <Button variant="secondary" onClick={() => setEditing(null)}>Cancel review</Button>
    </div>
    <CropEditor key={editorItem.id} data={editorItem.data} fileName={editorItem.file.name}
      initialRect={editorItem.rect || PLATFORM_DEFAULTS[editorItem.platform || "manual"]}
      busy={false} actionLabel="Use this crop"
      onCrop={(rect: CropRect) => {
        changeSettings(editorItem.id, { rect, reviewed: true, manualOverride: true });
        setEditing(null);
      }} />
  </div>;

  return <div className="mx-auto max-w-4xl">
    <div className="mb-6"><h2 className="text-xl font-bold">1. Upload & crop</h2><p className="mt-1 text-sm text-slate-500">Choose a marketplace for each PDF, set invoice options, and review any manual crops before merging.</p></div>
    {error && <div className="mb-5"><Alert title="Some files need attention" message={error} /></div>}
    <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; void upload(files); }} />
    {items.length === 0 && !adding && <PdfUploader multiple title="Drop your label PDFs here" hint="Mix marketplaces · up to 20 PDFs · 25 MB per file" onFiles={upload} />}
    {(items.length > 0 || locked) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">{items.length} / {MAX_MERGE_FILES} PDFs</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={locked || items.length >= MAX_MERGE_FILES} onClick={() => inputRef.current?.click()}>+ Add PDFs</Button>
        <Button variant="ghost" size="sm" onClick={reset}>Clear all</Button>
      </div>
    </div>}
    {locked && <div className="card mb-5 flex items-start justify-between gap-3 p-4" role="status">
      <ProgressBar label={progress || (adding ? "Reading PDF…" : "Cropping…")}
        value={adding && uploadBatch.total > 1 ? uploadBatch.completed / uploadBatch.total * 100 : undefined}
        detail={adding && uploadBatch.total > 1 ? `${uploadBatch.completed} of ${uploadBatch.total} files processed` : undefined} />
      <Button variant="secondary" size="sm" onClick={cancel}>Cancel</Button>
    </div>}
    <div className="space-y-4">
      {items.map((item, index) => <section key={item.id} className="card p-4 sm:p-5" aria-label={`Settings for ${item.file.name}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="break-all font-bold">{index + 1}. {item.file.name}</h3><p className="mt-1 text-xs text-slate-500">{formatBytes(item.file.size)}{item.readable ? ` · ${item.pageCount} page${item.pageCount === 1 ? "" : "s"}` : " · Could not open PDF"}</p></div>
          <Button variant="ghost" size="sm" disabled={locked} onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>Remove</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <PlatformChoices name={`platform-${item.id}`} value={item.platform} disabled={locked}
            onChange={(platform) => changeSettings(item.id, { platform })} />
          {item.readable && !item.platform && <p className="w-full text-xs text-slate-500">Choose a platform</p>}
          {(item.platform === "amazon" || item.platform === "meesho") && <InvoiceOptions
            name={`invoice-${item.id}`} disabled={locked} keepInvoices={item.keepInvoices}
            onChange={(keepInvoices) => changeSettings(item.id, { keepInvoices })} />}
          {item.platform && item.readable && (needsCropReview(item) || item.status === "attention") && <Button variant="secondary" disabled={locked} onClick={() => setEditing(item.id)}>{item.reviewed ? "Edit crop" : needsCropReview(item) ? "Review crop" : "Crop manually"}</Button>}
        </div>
        {item.readable && needsCropReview(item) && !item.reviewed && <p className="mt-3 text-sm text-amber-700">Review and confirm this file’s crop before processing.</p>}
        {item.status === "ready" && <p className="mt-3 text-sm font-semibold text-emerald-700">Ready to arrange{item.outputPages !== undefined ? ` · ${item.outputPages} page${item.outputPages === 1 ? "" : "s"}` : ""}</p>}
        {item.warning && <p className="mt-3 text-sm text-amber-800" role={item.status === "attention" ? "alert" : undefined}>{item.warning}</p>}
        {item.status === "attention" && <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={locked || !canProcess(item)} onClick={() => processBatch(item.id)}>Retry</Button>
          {item.readable && <Button variant="secondary" size="sm" disabled={locked || !item.platform} onClick={() => setItems((prev) => prev.map((i) => i.id === item.id ? keepOriginal(i) : i))}>Keep original unchanged</Button>}
        </div>}
      </section>)}
    </div>
    {items.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-lg text-sm text-slate-500">{allReady ? "Your PDFs are ready. Choose their order on the next screen." : "Successful crops are retained. Resolve any files needing attention before merging."}</p>
      <Button size="lg" disabled={locked || !canCrop} onClick={() => allReady ? arrange(items) : processBatch()}>{allReady ? "Arrange PDFs →" : "Crop"}</Button>
    </div>}
  </div>;
}
