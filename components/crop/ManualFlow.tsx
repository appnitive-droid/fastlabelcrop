"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/AppLink";
import dynamic from "next/dynamic";
import { yieldForPaint } from "@/lib/yield-for-paint";
import { useOperationGate } from "@/lib/use-operation-gate";
import PdfResult from "../pdf/PdfResult";
import InvoiceOptions from "./InvoiceOptions";
import PdfUploader from "../pdf/PdfUploader";
import ProgressBar from "../ui/ProgressBar";
import Button from "../ui/Button";
import { Alert, Spinner } from "../ui/primitives";
import {
  PLATFORM_DEFAULTS,
  defaultKeepInvoices,
  type CropRect,
  type Platform,
} from "@/lib/pdf/platform-defaults";
import { MAX_FILE_SIZE_BYTES, formatBytes } from "@/lib/constants";
import { fileToBytes, validatePdfFile } from "@/lib/file";

// Heavy pieces load only when needed — the upload screen paints first.
const CropEditor = dynamic(() => import("./CropEditor"), {
  ssr: false,
  loading: () => (
    <div className="card flex items-center justify-center px-6 py-16">
      <Spinner label="Loading editor…" />
    </div>
  ),
});

type Stage = "upload" | "options" | "edit" | "result";

export default function ManualFlow({ platform }: { platform: Platform }) {
  const gate = useOperationGate();
  const defaults = useMemo(() => PLATFORM_DEFAULTS[platform], [platform]);

  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [keepInvoices, setKeepInvoices] = useState(() => defaultKeepInvoices(platform));
  async function handleFiles(files: File[]) {
    const f = files[0];
    if (!f) return;
    const token = gate.begin();
    if (token === null) return;
    setError(null);
    setLoadingFile(true);
    try {
      await yieldForPaint();
      if (!gate.isCurrent(token)) return;
      const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
      if (problem) { setError(problem); return; }
      const bytes = await fileToBytes(f);
      if (!gate.isCurrent(token)) return;
      let n = 1;
      try {
        // pdf-lib loads on demand so the upload UI paints instantly.
        const { PDFDocument } = await import("pdf-lib");
        if (!gate.isCurrent(token)) return;
        const doc = await PDFDocument.load(bytes);
        if (!gate.isCurrent(token)) return;
        n = doc.getPageCount();
        if (n < 1) throw new Error("empty");
      } catch (e) {
        if (!gate.isCurrent(token)) return;
        console.error("[crop] upload validation failed:", e);
        setError(
          "This PDF could not be opened. It may be corrupted or password-protected. Try another file, or unlock it and re-export as PDF."
        );
        setLoadingFile(false);
        return;
      }
      setFile(f);
      setData(bytes);
      setPageCount(n);
      setResult(null);
      setKeepInvoices(defaultKeepInvoices(platform));
      setStage(platform === "meesho" ? "options" : "edit");
    } catch {
      if (!gate.isCurrent(token)) return;
      setError("Could not read that file. Please try a different PDF.");
    } finally {
      if (gate.isCurrent(token)) { setLoadingFile(false); gate.finish(token); }
    }
  }

  async function handleCrop(rect: CropRect) {
    if (!data || !file) return;
    const token = gate.begin();
    if (token === null) return;
    setError(null);
    setBusy(true);
    try {
      // Let the loading UI paint before the heavy pdf-lib work
      await yieldForPaint();
      const { cropPdf } = await import("@/lib/pdf/crop");
      if (!gate.isCurrent(token)) return;
      const out = await cropPdf(data, rect);
      if (!gate.isCurrent(token)) return;
      setResult(out);
      setStage("result");
    } catch (e) {
      if (!gate.isCurrent(token)) return;
      setError(e instanceof Error ? e.message : "Cropping failed. Please retry.");
    } finally {
      if (gate.isCurrent(token)) { setBusy(false); gate.finish(token); }
    }
  }

  function resetToUpload() {
    gate.invalidate();
    setLoadingFile(false);
    setStage("upload");
    setFile(null);
    setData(null);
    setResult(null);
    setError(null);
    setBusy(false);
    setKeepInvoices(defaultKeepInvoices(platform));
  }

  const resultName = file
    ? platform === "meesho" && keepInvoices ? file.name : file.name.replace(/\.pdf$/i, "") + "-cropped.pdf"
    : "cropped-label.pdf";

  return (
    <div>
      {error && (
        <div className="mb-5">
          <Alert title="Something needs attention" message={error} />
        </div>
      )}

      {stage === "upload" && (
        <div className="mx-auto max-w-2xl">
          {loadingFile ? (
            <div className="card flex items-start justify-between gap-3 px-6 py-8" role="status">
              <ProgressBar label="Reading PDF…" />
              <Button variant="secondary" size="sm" onClick={resetToUpload}>Cancel</Button>
            </div>
          ) : (
            <PdfUploader
              title="Drop your label PDF here"
              cta="Choose PDF"
              onFiles={handleFiles}
            />
          )}
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <Link href="/" className="font-semibold text-slate-500 hover:text-slate-800">
              ← Back to Dashboard
            </Link>
            <span className="text-slate-400">{platform === "meesho" ? "Choose whether to keep the invoice" : `Default crop: top ${Math.round(defaults.height * 100)}% of the page`}</span>
          </div>
        </div>
      )}

      {stage === "options" && platform === "meesho" && data && file && <div className="card mx-auto max-w-xl p-5 sm:p-7">
        <p className="mb-4 break-all text-sm font-bold">{file.name}</p>
        <InvoiceOptions name="meesho-invoice" keepInvoices={keepInvoices} onChange={setKeepInvoices} />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" onClick={() => {
            setError(null);
            if (keepInvoices) { setResult(data); setStage("result"); }
            else setStage("edit");
          }}>Continue</Button>
          <Button variant="secondary" size="lg" onClick={resetToUpload}>Choose Another PDF</Button>
        </div>
      </div>}

      {stage === "edit" && data && file && (
        <div className="animate-fadeUp">
          <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-bold text-white">
              PDF
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{file.name}</p>
              <p className="text-[12px] text-slate-500">
                {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"} · crop applies to all pages
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={resetToUpload} disabled={busy}>
              Remove / Change
            </Button>
            {platform === "meesho" && <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStage("options")}>Invoice options</Button>}
          </div>

          {busy && (
            <div className="card mb-5 flex items-center justify-center gap-3 border-accent-200 bg-accent-50 px-4 py-3.5">
              <Spinner label="Cropping your PDF…" />
            </div>
          )}

          <CropEditor data={data} fileName={file.name} initialRect={defaults} busy={busy} onCrop={handleCrop} />

          <div className="mt-5">
            <Link href="/" className="text-[13px] font-semibold text-slate-500 hover:text-slate-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {stage === "result" && result && <PdfResult data={result} filename={resultName} actions={<>
        <Button variant="secondary" size="lg" onClick={resetToUpload}>Choose Another PDF</Button>
        {platform === "meesho" && <Button variant="secondary" size="lg" onClick={() => { setResult(null); setStage("options"); }}>Invoice options</Button>}
        <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Back to Dashboard</Link>
      </>} />}
    </div>
  );
}
