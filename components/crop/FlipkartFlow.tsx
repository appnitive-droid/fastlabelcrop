"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PdfUploader from "../pdf/PdfUploader";
import Button from "../ui/Button";
import { Alert, Spinner } from "../ui/primitives";
import type { FlipkartCropResult } from "@/lib/pdf/flipkart";
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

type Stage = "upload" | "processing" | "result";

export default function FlipkartFlow() {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [original, setOriginal] = useState<Uint8Array | null>(null);
  const [result, setResult] = useState<FlipkartCropResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError(null);
    const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
    if (problem) {
      setError(problem);
      return;
    }
    setStage("processing");
    setProgress({ done: 0, total: 0 });
    try {
      const bytes = await fileToBytes(f);
      // Let the processing UI paint before the heavy work starts.
      await new Promise((r) => setTimeout(r, 60));
      // Detection + pdf-lib load on demand so upload paints instantly.
      const { cropFlipkartLabels } = await import("@/lib/pdf/flipkart");
      const out = await cropFlipkartLabels(bytes, (done, total) =>
        setProgress({ done, total })
      );
      setFileName(f.name);
      setOriginal(bytes);
      setResult(out);
      setStage("result");
    } catch (e) {
      console.error("[flipkart] auto-crop failed:", e);
      setError(
        e instanceof Error ? e.message : "Could not process this PDF. Please retry."
      );
      setStage("upload");
    }
  }

  function reset() {
    setStage("upload");
    setFileName("");
    setOriginal(null);
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  }

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const undetected =
    result?.pages.filter((p) => !p.detected).map((p) => p.pageNumber) ?? [];
  const noneDetected = result !== null && result.detectedCount === 0;
  const outName = fileName
    ? fileName.replace(/\.pdf$/i, "") + "-shipping-labels.pdf"
    : "flipkart-shipping-labels.pdf";

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
            title="Drop your Flipkart label PDF here"
            cta="Choose PDF"
            onFiles={handleFiles}
          />
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <Link href="/" className="font-semibold text-slate-500 hover:text-slate-800">
              ← Back to Dashboard
            </Link>
            <span className="text-slate-400">Label kept · invoice removed automatically</span>
          </div>
        </div>
      )}

      {stage === "processing" && (
        <div className="card mx-auto max-w-xl p-6 text-center sm:p-10">
          <Spinner label="Processing…" />
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent-600 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[12px] text-slate-400">
            🔒 Processed locally — your file never leaves your browser
          </p>
        </div>
      )}

      {stage === "result" && result && (
        <div className="mx-auto max-w-3xl animate-fadeUp">
          <div className="card p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                  noneDetected ? "bg-amber-100" : "bg-emerald-100"
                }`}
              >
                {noneDetected ? "!" : "✓"}
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {noneDetected
                    ? "Separator not found"
                    : `Shipping labels ready — invoice removed`}
                </h2>
                <p className="text-[13px] text-slate-500">
                  {result.detectedCount} of {result.totalPages} page
                  {result.totalPages === 1 ? "" : "s"} cropped ·{" "}
                  {formatBytes(result.pdf.length)}
                </p>
              </div>
            </div>

            {noneDetected ? (
              <div className="mt-5">
                <Alert
                  tone="warn"
                  title="No dotted separator detected"
                  message="We couldn't find the dotted line between the shipping label and the Tax Invoice on any page, so nothing was cropped. The file below is your original. Try a clearer scan, or crop manually."
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {result.pages.map((p) => (
                    <span
                      key={p.pageNumber}
                      title={
                        p.detected
                          ? `Page ${p.pageNumber}: label kept, invoice removed`
                          : `Page ${p.pageNumber}: separator not found — full page kept`
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                        p.detected
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      }`}
                    >
                      p{p.pageNumber} {p.detected ? "✓ label" : "⚠ full page"}
                    </span>
                  ))}
                </div>
                {undetected.length > 0 && (
                  <p className="mt-2 text-[13px] text-amber-700">
                    Page{undetected.length === 1 ? "" : "s"} {undetected.join(", ")} kept
                    full-size (separator not found there).
                  </p>
                )}
                <div className="mt-5">
                  <PdfViewer data={result.pdf} title="Cropped labels — invoice removed" />
                </div>
              </>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {!noneDetected && (
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => downloadBytes(result.pdf, outName)}
                >
                  ⬇ Download Labels PDF
                </Button>
              )}
              {noneDetected && original && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  size="lg"
                  onClick={() => downloadBytes(original, fileName || "original.pdf")}
                >
                  ⬇ Download Original PDF
                </Button>
              )}
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
