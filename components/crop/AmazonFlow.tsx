"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PdfUploader from "../pdf/PdfUploader";
import Button from "../ui/Button";
import { Alert, Spinner } from "../ui/primitives";
import type { AmazonProcessResult } from "@/lib/pdf/amazon";
import { MAX_FILE_SIZE_BYTES, formatBytes } from "@/lib/constants";
import { downloadBytes, fileToBytes, validatePdfFile } from "@/lib/file";

// Result preview loads only when needed — upload screen paints first.
const PdfViewer = dynamic(() => import("../pdf/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="card flex items-center justify-center px-6 py-16">
      <Spinner label="Loading preview…" />
    </div>
  ),
});

type Stage = "upload" | "options" | "processing" | "result";
type KeepOption = "labels" | "all";

export default function AmazonFlow() {
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
    setError(null);
    const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const data = await fileToBytes(f);
      // pdf-lib loads on demand so the upload UI paints instantly.
      const { PDFDocument } = await import("pdf-lib");
      // pdf-lib validation (no preview engine needed to accept the file).
      const doc = await PDFDocument.load(data, { ignoreEncryption: true });
      const n = doc.getPageCount();
      if (n < 1) throw new Error("empty");
      setFile(f);
      setBytes(data);
      setTotalPages(n);
      setOption("labels");
      setResult(null);
      setStage("options");
    } catch (e) {
      console.error("[amazon] upload validation failed:", e);
      setError(
        "This PDF could not be opened. It may be corrupted or password-protected. Try another file."
      );
    }
  }

  async function handleProcess() {
    if (!bytes) return;
    setError(null);
    setStage("processing");
    try {
      // Let the processing UI paint before the pdf-lib work.
      await new Promise((r) => setTimeout(r, 60));
      const { processAmazonPdf } = await import("@/lib/pdf/amazon");
      const out = await processAmazonPdf(bytes, option === "all");
      setResult(out);
      setStage("result");
    } catch (e) {
      console.error("[amazon] processing failed:", e);
      setError(e instanceof Error ? e.message : "Could not process this PDF. Please retry.");
      setStage("options");
    }
  }

  function reset() {
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
          <PdfUploader
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

      {stage === "result" && result && (
        <div className="mx-auto max-w-3xl animate-fadeUp">
          <div className="card p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg">
                ✓
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {result.unchanged ? "Original kept unchanged" : "Labels extracted"}
                </h2>
                <p className="text-[13px] text-slate-500">
                  {result.unchanged
                    ? `All ${result.totalPages} pages kept · ${formatBytes(result.pdf.length)}`
                    : `${result.keptPages.length} label${result.keptPages.length === 1 ? "" : "s"} kept · ${result.removedPages.length} invoice${result.removedPages.length === 1 ? "" : "s"} removed · ${formatBytes(result.pdf.length)}`}
                </p>
              </div>
            </div>

            {!result.unchanged && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => {
                  const kept = p % 2 === 1;
                  return (
                    <span
                      key={p}
                      title={kept ? `Page ${p}: label kept` : `Page ${p}: invoice removed`}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                        kept
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-400 line-through ring-1 ring-slate-200"
                      }`}
                    >
                      p{p} {kept ? "✓" : "✗"}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-5">
              <PdfViewer
                data={result.pdf}
                title={result.unchanged ? "Original PDF" : "Label pages in original order"}
              />
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" size="lg" onClick={() => downloadBytes(result.pdf, outName)}>
                ⬇ {result.unchanged ? "Download PDF" : "Download Labels PDF"}
              </Button>
              <Button variant="secondary" size="lg" onClick={reset}>
                Process Another PDF
              </Button>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
