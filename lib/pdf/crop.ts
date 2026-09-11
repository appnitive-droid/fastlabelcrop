import { PDFDocument, type PDFPage } from "pdf-lib";
import { clampRect, type CropRect } from "./platform-defaults";

/**
 * Tighten one page to a normalized rect (top-left origin, 0..1).
 * Only the page boxes change — all content stays vector, nothing rasterizes.
 */
function applyRectToPage(page: PDFPage, rectNormalized: CropRect): void {
  const rect = clampRect(rectNormalized);
  const { width: pw, height: ph } = page.getSize();
  const xPt = rect.x * pw;
  const wPt = rect.width * pw;
  const hPt = rect.height * ph;
  // UI origin is top-left; PDF origin is bottom-left.
  const yBottomPt = ph - (rect.y * ph + hPt);

  const nx = Math.max(0, Math.min(pw - 1, xPt));
  const ny = Math.max(0, Math.min(ph - 1, yBottomPt));
  const nw = Math.max(1, Math.min(pw - nx, wPt));
  const nh = Math.max(1, Math.min(ph - ny, hPt));

  page.setCropBox(nx, ny, nw, nh);
  page.setMediaBox(nx, ny, nw, nh);
}

async function loadOrThrow(input: Uint8Array) {
  try {
    return await PDFDocument.load(input, { ignoreEncryption: true });
  } catch {
    throw new Error(
      "This PDF could not be opened. It may be corrupted or password-protected."
    );
  }
}

/**
 * Crop every page of a PDF to the given normalized rectangle.
 * Implemented by tightening each page's CropBox + MediaBox — vector content
 * and quality are fully preserved (no rasterization).
 */
export async function cropPdf(
  input: Uint8Array,
  rectNormalized: CropRect
): Promise<Uint8Array> {
  const rect = clampRect(rectNormalized);
  if (rect.width < 0.02 || rect.height < 0.02) {
    throw new Error("Crop area is too small. Please enlarge the selection.");
  }

  const doc = await loadOrThrow(input);
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages to crop.");

  try {
    for (const page of pages) applyRectToPage(page, rect);
  } catch {
    throw new Error("Could not apply the crop to this PDF.");
  }

  try {
    return await doc.save();
  } catch {
    throw new Error("Could not generate the cropped PDF. Please retry.");
  }
}

/**
 * Crop each page to its own rect. `null` keeps that page FULL SIZE —
 * used when automatic detection finds no separator on a page, so we never
 * silently produce a wrong crop. Page order is preserved.
 */
export async function cropPdfPerPage(
  input: Uint8Array,
  rects: (CropRect | null)[]
): Promise<Uint8Array> {
  const doc = await loadOrThrow(input);
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages to crop.");

  try {
    for (let i = 0; i < pages.length; i++) {
      const rect = rects[i];
      if (rect) applyRectToPage(pages[i], rect);
    }
  } catch {
    throw new Error("Could not apply the crop to this PDF.");
  }

  try {
    return await doc.save();
  } catch {
    throw new Error("Could not generate the cropped PDF. Please retry.");
  }
}
