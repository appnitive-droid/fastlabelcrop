import { PDFDocument, type PDFPage } from "pdf-lib";
import { clampRect, type CropRect } from "./platform-defaults";

/**
 * Tighten one page to a normalized rect (top-left origin, 0..1).
 * Only the page boxes change — all content stays vector, nothing rasterizes.
 */
function applyRectToPage(page: PDFPage, rectNormalized: CropRect): void {
  const rect = clampRect(rectNormalized);
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  let x = Math.max(media.x, crop.x);
  let y = Math.max(media.y, crop.y);
  let width = Math.min(media.x + media.width, crop.x + crop.width) - x;
  let height = Math.min(media.y + media.height, crop.y + crop.height) - y;
  // Match pdf.js: an empty intersection falls back to the MediaBox.
  if (width <= 0 || height <= 0) ({ x, y, width, height } = media);
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const toPdf = (u: number, v: number): [number, number] => {
    switch (rotation) {
      case 0: return [x + u * width, y + (1 - v) * height];
      case 90: return [x + v * width, y + u * height];
      case 180: return [x + (1 - u) * width, y + v * height];
      case 270: return [x + (1 - v) * width, y + (1 - u) * height];
      default: throw new Error("Unsupported page rotation");
    }
  };
  const corners = [
    toPdf(rect.x, rect.y), toPdf(rect.x + rect.width, rect.y),
    toPdf(rect.x, rect.y + rect.height),
    toPdf(rect.x + rect.width, rect.y + rect.height),
  ];
  const left = Math.min(...corners.map((p) => p[0]));
  const bottom = Math.min(...corners.map((p) => p[1]));
  const w = Math.max(...corners.map((p) => p[0])) - left;
  const h = Math.max(...corners.map((p) => p[1])) - bottom;
  if (w <= 0 || h <= 0) throw new Error("Empty crop area");
  page.setCropBox(left, bottom, w, h);
  page.setMediaBox(left, bottom, w, h);
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
