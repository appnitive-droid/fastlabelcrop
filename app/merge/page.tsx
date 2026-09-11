"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import PdfUploader from "@/components/pdf/PdfUploader";
import MergeFileList from "@/components/merge/MergeFileList";
import type { MergeItem } from "@/components/merge/SortablePdfCard";
import Button from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/primitives";
import { mergePdfs } from "@/lib/pdf/merge";
import { MAX_FILE_SIZE_BYTES, MAX_MERGE_FILES, formatBytes } from "@/lib/constants";
import { downloadBytes, fileToBytes, uid, validatePdfFile } from "@/lib/file";
import { PDFDocument } from "pdf-lib";

type Stage = "select" | "result";

export default function MergePage() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [stage, setStage] = useState<Stage>("select");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [resultStats, setResultStats] = useState<{ files: number; pages: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = useMemo(
    () => items.reduce((s, i) => s + (i.pageCount || 0), 0),
    [items]
  );

  async function handleFiles(files: File[]) {
    setError(null);
    if (items.length + files.length > MAX_MERGE_FILES) {
      setError(`You can merge up to ${MAX_MERGE_FILES} PDFs at once. Remove some files or merge in batches.`);
      files = files.slice(0, MAX_MERGE_FILES - items.length);
      if (files.length === 0) return;
    }
    setAdding(true);
    const next: MergeItem[] = [];
    for (const f of files) {
      const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
      if (problem) {
        setError(problem);
        continue;
      }
      try {
        const bytes = await fileToBytes(f);
        let pages: number | null = null;
        try {
          // Validate with pdf-lib (no worker needed) so a preview-engine
          // hiccup can never block a valid upload. Thumbnails render
          // separately and fail soft per-card.
          const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          pages = doc.getPageCount();
          if (pages < 1) throw new Error("empty");
        } catch (err) {
          console.error("[merge] upload validation failed:", err);
          setError(`"${f.name}" could not be opened. It may be corrupted or password-protected — skipped.`);
          continue;
        }
        next.push({ id: uid(), file: f, data: bytes, pageCount: pages });
      } catch {
        setError(`Could not read "${f.name}". It was skipped.`);
      }
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      setStage("select");
      setResult(null);
    }
    setAdding(false);
  }

  async function handleMerge() {
    setError(null);
    if (items.length < 2) {
      setError("Select at least 2 PDFs to merge.");
      return;
    }
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 60));
      const out = await mergePdfs(items.map((i) => i.data));
      let pages = totalPages;
      try {
        const doc = await PDFDocument.load(out);
        pages = doc.getPageCount();
      } catch {
        /* keep estimate */
      }
      setResult(out);
      setResultStats({ files: items.length, pages });
      setStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merging failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    setItems([]);
    setResult(null);
    setResultStats(null);
    setError(null);
    setStage("select");
  }

  return (
    <div className="min-h-screen pb-28">
      <SiteHeader
        title="Merge PDFs"
        subtitle="Combine multiple PDF files into one document and arrange them in the order you want."
      />
      <main className="container-x animate-fadeIn py-8">
        {error && (
          <div className="mb-5">
            <Alert title="Something needs attention" message={error} />
          </div>
        )}

        {stage === "select" && (
          <>
            {items.length === 0 ? (
              <div className="mx-auto max-w-2xl">
                {adding ? (
                  <div className="card flex items-center justify-center px-6 py-16">
                    <Spinner label="Reading your PDFs…" />
                  </div>
                ) : (
                  <PdfUploader
                    multiple
                    title="Drop your PDFs here"
                    hint="First-page thumbnails appear after upload"
                    cta="Choose PDF Files"
                    onFiles={handleFiles}
                  />
                )}
              </div>
            ) : (
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
                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={adding}>
                      {adding ? "Adding…" : "+ Add more"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      Clear all
                    </Button>
                  </div>
                </div>

                <MergeFileList
                  items={items}
                  onReorder={setItems}
                  onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
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

        {stage === "result" && result && (
          <div className="mx-auto max-w-xl animate-fadeUp">
            <div className="card p-6 text-center sm:p-10">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                ✓
              </span>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
                Merge complete
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your PDFs have been combined into a single print-ready file.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 px-2 py-3">
                  <p className="text-lg font-extrabold tabular-nums text-slate-900">
                    {resultStats?.files ?? items.length}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    PDFs
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-3">
                  <p className="text-lg font-extrabold tabular-nums text-slate-900">
                    {resultStats?.pages ?? "—"}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Pages
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-3">
                  <p className="text-lg font-extrabold tabular-nums text-slate-900">
                    {formatBytes(result.length)}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Size
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                  PDF
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">merged.pdf</p>
                  <p className="text-[12px] text-slate-500">
                    Ready to download · processed locally in your browser
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" size="lg" onClick={() => downloadBytes(result, "merged.pdf")}>
                  ⬇ Download Merged PDF
                </Button>
                <Button variant="secondary" size="lg" onClick={resetAll}>
                  Merge More PDFs
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
      </main>

      {/* Sticky merge bar */}
      {stage === "select" && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur">
          <div className="container-x flex flex-col items-center justify-between gap-2 py-3 sm:flex-row">
            <p className="text-[13px] text-slate-500">
              {items.length < 2 ? (
                <>Add at least <b>one more PDF</b> to enable merging.</>
              ) : (
                <>Ready — pages will be combined in the order shown above.</>
              )}
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto sm:min-w-56"
              disabled={items.length < 2 || busy || adding}
              loading={busy}
              onClick={handleMerge}
            >
              {busy ? "Merging your PDFs…" : `Merge ${items.length} PDF${items.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
