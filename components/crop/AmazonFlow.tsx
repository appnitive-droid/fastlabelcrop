"use client";

import { useState } from "react";
import Link from "@/components/ui/AppLink";
import { yieldForPaint } from "@/lib/yield-for-paint";
import { useOperationGate } from "@/lib/use-operation-gate";
import PdfResult from "../pdf/PdfResult";
import PdfUploader from "../pdf/PdfUploader";
import ProgressBar from "../ui/ProgressBar";
import Button from "../ui/Button";
import { Alert, Spinner } from "../ui/primitives";
import type { AmazonProcessResult } from "@/lib/pdf/amazon";
import { MAX_FILE_SIZE_BYTES, formatBytes } from "@/lib/constants";
import { fileToBytes, validatePdfFile } from "@/lib/file";


type Stage = "upload" | "options" | "processing" | "result";
type KeepOption = "labels" | "all";

export default function AmazonFlow() {
  const gate = useOperationGate();
  const [loadingFile, setLoadingFile] = useState(false);
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [option, setOption] = useState<KeepOption>("labels");
  const [result, setResult] = useState<AmazonProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelCount = Math.ceil(totalPages / 2);

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
      const data = await fileToBytes(f);
      if (!gate.isCurrent(token)) return;
      // pdf-lib loads on demand so the upload UI paints instantly.
      const { PDFDocument } = await import("pdf-lib");
      if (!gate.isCurrent(token)) return;
      // pdf-lib validation (no preview engine needed to accept the file).
      const doc = await PDFDocument.load(data);
      if (!gate.isCurrent(token)) return;
      const n = doc.getPageCount();
      if (n < 1) throw new Error("empty");
      setFile(f);
      setBytes(data);
      setTotalPages(n);
      setOption("labels");
      setResult(null);
      setStage("options");
    } catch (e) {
      if (!gate.isCurrent(token)) return;
      console.error("[amazon] upload validation failed:", e);
      setError(
        "This PDF could not be opened. It may be corrupted or password-protected. Try another file."
      );
    } finally {
      if (gate.isCurrent(token)) { setLoadingFile(false); gate.finish(token); }
    }
  }

  async function handleProcess() {
    if (!bytes) return;
    const token = gate.begin();
    if (token === null) return;
    setError(null);
    setStage("processing");
    try {
      // Let the processing UI paint before the pdf-lib work.
      await yieldForPaint();
      const { processAmazonPdf } = await import("@/lib/pdf/amazon");
      if (!gate.isCurrent(token)) return;
      const out = await processAmazonPdf(bytes, option === "all");
      if (!gate.isCurrent(token)) return;
      setResult(out);
      setStage("result");
    } catch (e) {
      if (!gate.isCurrent(token)) return;
      console.error("[amazon] processing failed:", e);
      setError(e instanceof Error ? e.message : "Could not process this PDF. Please retry.");
      setStage("options");
    } finally { gate.finish(token); }
  }

  function reset() {
    gate.invalidate();
    setLoadingFile(false);
    setStage("upload");
    setFile(null);
    setBytes(null);
    setTotalPages(0);
    setOption("labels");
    setResult(null);
    setError(null);
  }

  const outName =
    option === "all"
      ? file?.name || "original.pdf"
      : (file?.name.replace(/\.pdf$/i, "") || "amazon") + "-labels.pdf";

  return (
    <div>
      {error && (
        <div className="mb-5">
          <Alert title="Something needs attention" message={error} />
        </div>
      )}

      {stage === "upload" && (
        <div className="mx-auto max-w-2xl">
          {loadingFile && <div className="mb-4 flex items-center justify-between gap-3" role="status"><ProgressBar label="Reading PDF…" /><Button variant="secondary" size="sm" onClick={reset}>Cancel</Button></div>}
          <PdfUploader
            disabled={loadingFile}
            title="Drop your Amazon label PDF here"
            cta="Choose PDF"
            onFiles={handleFiles}
          />
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <Link href="/" className="font-semibold text-slate-500 hover:text-slate-800">
              ← Back to Dashboard
            </Link>
            <span className="text-slate-400">Labels on odd pages · invoices on even</span>
          </div>
        </div>
      )}

      {stage === "options" && file && (
        <div className="mx-auto max-w-xl animate-fadeUp">
          <div className="card mb-4 flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-bold text-white">
              PDF
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{file.name}</p>
              <p className="text-[12px] text-slate-500">
                {formatBytes(file.size)} · {totalPages} page{totalPages === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={reset}>
              Change
            </Button>
          </div>

          <div className="card p-5 sm:p-6">
            <h2 className="text-[16px] font-bold tracking-tight text-slate-900">
              What do you want to keep?
            </h2>
            <div className="mt-4 flex flex-col gap-3" role="radiogroup" aria-label="What to keep">
              <button
                role="radio"
                aria-checked={option === "labels"}
                onClick={() => setOption("labels")}
                className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                  option === "labels"
                    ? "border-accent-600 bg-accent-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    option === "labels" ? "border-accent-600" : "border-slate-300"
                  }`}
                >
                  {option === "labels" && <span className="h-2.5 w-2.5 rounded-full bg-accent-600" />}
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">
                    Labels only
                    <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-bold text-accent-800">
                      Recommended
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-slate-500">
                    Keeps pages {Array.from({ length: labelCount }, (_, i) => 2 * i + 1).join(", ") || "—"} and
                    removes the invoice pages.
                  </span>
                </span>
              </button>

              <button
                role="radio"
                aria-checked={option === "all"}
                onClick={() => setOption("all")}
                className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                  option === "all"
                    ? "border-accent-600 bg-accent-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    option === "all" ? "border-accent-600" : "border-slate-300"
                  }`}
                >
                  {option === "all" && <span className="h-2.5 w-2.5 rounded-full bg-accent-600" />}
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">Labels + Invoices</span>
                  <span className="mt-0.5 block text-[13px] text-slate-500">
                    Keeps the original PDF unchanged — all {totalPages} pages.
                  </span>
                </span>
              </button>
            </div>

            <Button size="lg" className="mt-5 w-full" onClick={handleProcess}>
              {option === "labels" ? `Extract ${labelCount} Label${labelCount === 1 ? "" : "s"}` : "Continue with Original"}
            </Button>
          </div>
        </div>
      )}

      {stage === "processing" && (
        <div className="card mx-auto max-w-xl p-6 text-center sm:p-10">
          <Spinner label="Processing…" />
          <p className="mt-3 text-[12px] text-slate-400">
            🔒 Processed locally — your file never leaves your browser
          </p>
        </div>
      )}

      {stage === "result" && result && <PdfResult data={result.pdf} filename={outName} actions={<>
        <Button variant="secondary" size="lg" onClick={reset}>Process Another PDF</Button>
        <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Back to Dashboard</Link>
      </>} />}
    </div>
  );
}
