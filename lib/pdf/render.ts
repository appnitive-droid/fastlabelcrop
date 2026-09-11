"use client";

/**
 * All pdfjs-dist interaction lives here. UI components call these helpers —
 * they never import pdfjs-dist directly.
 *
 * NOTE: the worker is served locally at /pdf.worker.min.mjs (copied from the
 * installed pdfjs-dist via `npm run copy-worker`, also run on postinstall).
 * A pinned CDN worker URL would break on every pdfjs-dist minor upgrade with
 * "API version X does not match Worker version Y" — which surfaces as a
 * generic "could not be opened" error for perfectly valid PDFs.
 */

type PdfJs = typeof import("pdfjs-dist");

let cached: PdfJs | null = null;
let workerReady: Promise<void> | null = null;

/**
 * Point pdf.js at a working, version-matched worker before first use.
 * Primary: local /pdf.worker.min.mjs (copied from the installed package).
 * Fallback: jsDelivr at the exact RUNNING version (never hardcoded).
 * If both are unreachable (offline), pdf.js itself falls back to its
 * in-thread fake worker — rendering still works, just slower.
 */
async function ensureWorker(mod: PdfJs): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = (async () => {
    const local = "/pdf.worker.min.mjs";
    try {
      const res = await fetch(local, { method: "HEAD" });
      if (res.ok) {
        mod.GlobalWorkerOptions.workerSrc = local;
        return;
      }
      console.warn(`[pdf] local worker missing (HTTP ${res.status}), using CDN fallback`);
    } catch (e) {
      console.warn("[pdf] local worker unreachable, using CDN fallback:", e);
    }
    const version = (mod as unknown as { version?: string }).version ?? "4.10.38";
    mod.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  })();
  return workerReady;
}

export async function getPdfJs(): Promise<PdfJs> {
  if (cached) return cached;
  const mod = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    await ensureWorker(mod);
  }
  cached = mod;
  return mod;
}

export type PdfOpenErrorCode = "password" | "worker" | "corrupt";

export class PdfOpenError extends Error {
  code: PdfOpenErrorCode;
  constructor(code: PdfOpenErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Classify a pdf.js load failure so the UI can show a specific message. */
function classifyLoadError(err: unknown): PdfOpenError {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  const message = err instanceof Error ? err.message : String(err);

  if (name === "PasswordException" || /password/i.test(message)) {
    return new PdfOpenError(
      "password",
      "This PDF is password-protected. Please unlock it (e.g. print to a new PDF) and try again."
    );
  }
  if (
    /worker|fake.*worker|setting up.*worker|version.*match|failed to fetch/i.test(
      message
    )
  ) {
    return new PdfOpenError(
      "worker",
      "The PDF preview engine failed to start (worker could not load). Check your connection and reload the page — your file itself is likely fine."
    );
  }
  return new PdfOpenError(
    "corrupt",
    "This PDF could not be opened. It may be corrupted or in an unsupported format."
  );
}

async function loadDocument(data: Uint8Array) {
  const pdfjs = await getPdfJs();
  const copy = new Uint8Array(data);
  // Clone into a fresh ArrayBuffer — pdf.js detaches (transfers) the buffer.
  const buf = copy.buffer.slice(0) as ArrayBuffer;
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  } catch (err) {
    // Log the real error for debugging; the UI shows the friendly message.
    console.error("[pdf] failed to open document:", err);
    throw classifyLoadError(err);
  }
}

export async function getPdfPageCount(data: Uint8Array): Promise<number> {
  const doc = await loadDocument(data);
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/** Thrown when a render was superseded by a newer one. Callers must swallow it (no error UI). */
export class RenderCancelled extends Error {
  constructor() {
    super("Render superseded");
    this.name = "RenderCancelled";
  }
}

/**
 * Latest paint task per canvas. A newer render cancels the previous one —
 * pdf.js throws if two paints target the same canvas concurrently
 * ("Cannot use the same canvas during multiple render() operations"), which
 * otherwise happens on StrictMode double-runs or fast page navigation.
 */
const activeTasks = new WeakMap<HTMLCanvasElement, { cancel: () => void }>();

function isPdfCancelError(err: unknown): boolean {
  return (
    err instanceof RenderCancelled ||
    (err instanceof Error && err.name === "RenderingCancelledException")
  );
}

/** Render a page into a canvas element. Returns page dimensions in CSS px. */
export async function renderPageToCanvas(opts: {
  data: Uint8Array;
  pageNumber?: number;
  canvas: HTMLCanvasElement;
  scale?: number;
  /** max width in css px; scales down proportionally */
  maxWidth?: number;
  /** when true, this run is stale — it must stop before touching the canvas */
  isStale?: () => boolean;
}): Promise<{ width: number; height: number; numPages: number }> {
  const { data, pageNumber = 1, canvas, scale = 2, maxWidth, isStale } = opts;
  const stale = () => isStale?.() ?? false;
  const doc = await loadDocument(data);
  try {
    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages));
    let viewport = page.getViewport({ scale });
    if (maxWidth && viewport.width > maxWidth) {
      const s = maxWidth / viewport.width;
      viewport = page.getViewport({ scale: scale * s });
    }
    // Synchronous handoff: staleness check + previous-task cancel + take
    // ownership happen with no awaits between, so runs can't interleave here.
    // Whoever arrives last always wins; earlier runs reject as cancelled.
    if (stale()) throw new RenderCancelled();
    activeTasks.get(canvas)?.cancel();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const task = page.render({ canvasContext: ctx, viewport });
    activeTasks.set(canvas, task);
    try {
      await task.promise;
    } finally {
      if (activeTasks.get(canvas) === task) activeTasks.delete(canvas);
    }
    page.cleanup();
    return { width: viewport.width, height: viewport.height, numPages: doc.numPages };
  } catch (err) {
    if (isPdfCancelError(err)) throw new RenderCancelled();
    console.error("[pdf] failed to render page:", err);
    if (err instanceof PdfOpenError) throw err;
    throw classifyLoadError(err);
  } finally {
    await doc.destroy();
  }
}

/** Render first page to a small thumbnail data URL. */
export async function renderThumbnail(
  data: Uint8Array,
  targetWidth = 220
): Promise<string> {
  const doc = await loadDocument(data);
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("[pdf] failed to render thumbnail:", err);
    if (err instanceof PdfOpenError) throw err;
    throw classifyLoadError(err);
  } finally {
    await doc.destroy();
  }
}

/**
 * Render a page to raw pixels (offscreen, fresh canvas per call so parallel
 * renders never share a canvas). Used for ANALYSIS (e.g. separator
 * detection) — never for output, so the PDF itself stays fully vector.
 */
export async function renderPageToImageData(opts: {
  data: Uint8Array;
  pageNumber: number;
  targetWidth?: number;
}): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
  const { data, pageNumber, targetWidth = 900 } = opts;
  const doc = await loadDocument(data);
  try {
    const total = doc.numPages;
    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), total));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { pixels: img.data, width: canvas.width, height: canvas.height };
  } catch (err) {
    console.error("[pdf] failed to render analysis image:", err);
    if (err instanceof PdfOpenError) throw err;
    throw classifyLoadError(err);
  } finally {
    await doc.destroy();
  }
}

export interface PageTextLine {
  text: string;
  /** 0..1 from the TOP of the page */
  yTopNorm: number;
}

/** Extract text lines with normalized vertical positions (for anchor hints). */
export async function getPageTextLines(
  data: Uint8Array,
  pageNumber: number
): Promise<PageTextLine[]> {
  const doc = await loadDocument(data);
  try {
    const total = doc.numPages;
    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), total));
    const height = page.getViewport({ scale: 1 }).height || 1;
    const tc = await page.getTextContent();
    const lines: PageTextLine[] = [];
    for (const raw of tc.items as Array<{ str?: unknown; transform?: unknown }>) {
      if (typeof raw?.str !== "string" || raw.str.trim() === "") continue;
      const t = raw.transform as number[] | undefined;
      const y = Array.isArray(t) && typeof t[5] === "number" ? t[5] : NaN;
      if (!Number.isFinite(y)) continue;
      // pdf.js text coords are in PDF points, bottom-left origin.
      lines.push({ text: raw.str, yTopNorm: 1 - y / height });
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}
