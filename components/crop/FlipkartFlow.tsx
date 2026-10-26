"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/AppLink";
import { yieldForPaint } from "@/lib/yield-for-paint";
import { useOperationGate } from "@/lib/use-operation-gate";
import PdfResult from "../pdf/PdfResult";
import PdfUploader from "../pdf/PdfUploader";
import ProgressBar from "../ui/ProgressBar";
import Button from "../ui/Button";
import { Alert } from "../ui/primitives";
import type { FlipkartCropResult } from "@/lib/pdf/flipkart";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { fileToBytes, validatePdfFile } from "@/lib/file";


type Stage = "upload" | "reading" | "processing" | "result";

export default function FlipkartFlow() {
  const gate = useOperationGate();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [original, setOriginal] = useState<Uint8Array | null>(null);
  const [result, setResult] = useState<FlipkartCropResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  async function handleFiles(files: File[]) {
    const f = files[0];
    if (!f) return;
    const token = gate.begin();
    if (token === null) return;
    const abort = new AbortController();
    controller.current = abort;
    setError(null);
    setStage("reading");
    setProgress({ done: 0, total: 0 });
    try {
      await yieldForPaint();
      if (!gate.isCurrent(token)) return;
      const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
      if (problem) { setError(problem); setStage("upload"); return; }
      const bytes = await fileToBytes(f);
      if (!gate.isCurrent(token)) return;
      setStage("processing");
      // Let the processing UI paint before the heavy work starts.
      await yieldForPaint();
      // Detection + pdf-lib load on demand so upload paints instantly.
      const { cropFlipkartLabels } = await import("@/lib/pdf/flipkart");
      if (!gate.isCurrent(token)) return;
      const out = await cropFlipkartLabels(bytes, (done, total) => {
        if (gate.isCurrent(token)) setProgress({ done, total });
      }, abort.signal);
      if (!gate.isCurrent(token)) return;
      setFileName(f.name);
      setOriginal(bytes);
      setResult(out);
      setStage("result");
    } catch (e) {
      if (!gate.isCurrent(token)) return;
      console.error("[flipkart] auto-crop failed:", e);
      setError(
        e instanceof Error ? e.message : "Could not process this PDF. Please retry."
      );
      setStage("upload");
    } finally { gate.finish(token); }
  }

  function reset() {
    gate.invalidate();
    controller.current?.abort();
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

      {(stage === "reading" || stage === "processing") && (
        <div className="card mx-auto max-w-xl p-6 text-center sm:p-10" role="status">
          <ProgressBar label={stage === "reading" ? "Reading PDF…" : "Processing PDF…"}
            value={stage === "processing" && progress.total > 0 ? pct : undefined} />
          <Button variant="secondary" size="sm" className="mt-4" onClick={reset}>Cancel</Button>
          <p className="mt-1 text-[12px] text-slate-400">
            🔒 Processed locally — your file never leaves your browser
          </p>
        </div>
      )}

      {stage === "result" && result && <PdfResult
        data={noneDetected && original ? original : result.pdf}
        filename={noneDetected ? fileName || "original.pdf" : outName}
        showPreview={!noneDetected}
        warning={noneDetected ? <Alert tone="warn" title="Could not crop this PDF" message="No label boundary was detected. You can download your original PDF, try another file, or use manual cropping." />
          : undetected.length > 0 ? <p className="text-sm text-amber-700" role="alert">Page{undetected.length === 1 ? "" : "s"} {undetected.join(", ")} could not be cropped. Review the preview before printing.</p> : undefined}
        actions={<>
          <Button variant="secondary" size="lg" onClick={reset}>Process Another PDF</Button>
          <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Back to Dashboard</Link>
        </>} />}
    </div>
  );
}
