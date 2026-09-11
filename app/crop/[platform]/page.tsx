"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import PdfUploader from "@/components/pdf/PdfUploader";
import PdfViewer from "@/components/pdf/PdfViewer";
import CropEditor from "@/components/crop/CropEditor";
import FlipkartFlow from "@/components/crop/FlipkartFlow";
import AmazonFlow from "@/components/crop/AmazonFlow";
import Button from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/primitives";
import { cropPdf } from "@/lib/pdf/crop";
import { PDFDocument } from "pdf-lib";
import { PLATFORM_DEFAULTS, PLATFORM_META, isPlatform, platformLogo, type CropRect, type Platform } from "@/lib/pdf/platform-defaults";
import { MAX_FILE_SIZE_BYTES, formatBytes } from "@/lib/constants";
import { downloadBytes, fileToBytes, validatePdfFile } from "@/lib/file";

type Stage = "upload" | "edit" | "result";

export default function CropPlatformPage({ params }: { params: { platform: string } }) {
  const slug = params.platform?.toLowerCase() || "";
  const valid = isPlatform(slug);
  const platform: Platform = valid ? (slug as Platform) : "amazon";
  const meta = PLATFORM_META[platform];
  const defaults = useMemo(() => PLATFORM_DEFAULTS[platform], [platform]);

  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  if (!valid) {
    return (
      <div className="min-h-screen">
        <SiteHeader title="Unknown platform" subtitle="That label type doesn't exist." />
        <main className="container-x py-12">
          <Alert
            title="Unknown label platform"
            message={`"${params.platform}" isn't a supported option. Choose Amazon, Flipkart, Meesho or Manual.`}
          />
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accent-700 hover:underline">
            ← Back to Dashboard
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (platform === "amazon") {
    return (
      <div className="min-h-screen">
        <SiteHeader
          title="Crop Amazon Label"
          subtitle="Upload your label PDF and choose what to keep — labels sit on odd pages, invoices on even."
          logoSrc={platformLogo(platform)}
          logoAlt="Amazon"
        />
        <main className="container-x animate-fadeIn py-8">
          <AmazonFlow />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (platform === "flipkart") {
    return (
      <div className="min-h-screen">
        <SiteHeader
          title="Crop Flipkart Label"
          subtitle="Upload your label PDF — we auto-detect the dotted separator and keep just the shipping label."
          logoSrc={platformLogo(platform)}
          logoAlt="Flipkart"
        />
        <main className="container-x animate-fadeIn py-8">
          <FlipkartFlow />
        </main>
        <SiteFooter />
      </div>
    );
  }

  async function handleFiles(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError(null);
    const problem = validatePdfFile(f, MAX_FILE_SIZE_BYTES);
    if (problem) {
      setError(problem);
      return;
    }
    setLoadingFile(true);
    try {
      const bytes = await fileToBytes(f);
      let n = 1;
      try {
        // Validate with pdf-lib (no worker needed) so a preview-engine
        // hiccup can never block a valid upload.
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        n = doc.getPageCount();
        if (n < 1) throw new Error("empty");
      } catch (e) {
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
      setStage("edit");
    } catch {
      setError("Could not read that file. Please try a different PDF.");
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleCrop(rect: CropRect) {
    if (!data || !file) return;
    setError(null);
    setBusy(true);
    try {
      // Let the loading UI paint before the heavy pdf-lib work
      await new Promise((r) => setTimeout(r, 60));
      const out = await cropPdf(data, rect);
      setResult(out);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cropping failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  function resetToUpload() {
    setStage("upload");
    setFile(null);
    setData(null);
    setResult(null);
    setError(null);
    setBusy(false);
  }

  const resultName = file ? file.name.replace(/\.pdf$/i, "") + "-cropped.pdf" : "cropped-label.pdf";

  const isManualGeneric = platform === "manual";
  const manualTitle = isManualGeneric ? "Manual Crop" : `Crop ${meta.name} Label`;
  const manualSubtitle = isManualGeneric
    ? "Upload any PDF and crop it manually before downloading."
    : "Upload your label PDF and crop it before downloading.";

  return (
    <div className="min-h-screen">
      <SiteHeader
        title={manualTitle}
        subtitle={manualSubtitle}
        logoSrc={platformLogo(platform)}
        logoAlt={meta.name}
      />
      <main className="container-x animate-fadeIn py-8">
        {error && (
          <div className="mb-5">
            <Alert title="Something needs attention" message={error} />
          </div>
        )}

        {stage === "upload" && (
          <div className="mx-auto max-w-2xl">
            {loadingFile ? (
              <div className="card flex items-center justify-center gap-3 px-6 py-16">
                <Spinner label="Reading your PDF…" />
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
              <span className="text-slate-400">Default crop: top {Math.round(defaults.height * 100)}% of the page</span>
            </div>
          </div>
        )}

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
              <Button variant="secondary" size="sm" onClick={resetToUpload}>
                Remove / Change
              </Button>
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

        {stage === "result" && result && (
          <div className="mx-auto max-w-3xl animate-fadeUp">
            <div className="card p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg">✓</span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Cropped PDF Preview</h2>
                  <p className="text-[13px] text-slate-500">
                    {formatBytes(result.length)} · rendered from the actual cropped file
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <PdfViewer data={result} title="Cropped output" />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" size="lg" onClick={() => downloadBytes(result, resultName)}>
                  ⬇ Download PDF
                </Button>
                <Button variant="secondary" size="lg" onClick={resetToUpload}>
                  Crop Another PDF
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
      <SiteFooter />
    </div>
  );
}
