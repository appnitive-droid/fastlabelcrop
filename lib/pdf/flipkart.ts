"use client";

/**
 * Flipkart label auto-crop.
 *
 * Layout assumption (Flipkart shipping PDFs):
 *   [ shipping label (top) ]
 *   - - - - - - - - - - - - -   <- horizontal dotted/dashed separator
 *   [ Tax Invoice + details (bottom) ]
 *
 * HOW THE SEPARATOR DETECTION WORKS
 * ---------------------------------
 * We deliberately do NOT hard-code a Y coordinate: the separator sits at a
 * different height on different pages/templates. Instead, per page:
 *
 *  1. Render the page to an offscreen bitmap (analysis ONLY — the final
 *     output is cropped with pdf-lib boxes, so all text/barcodes/QR codes
 *     stay sharp vector content; nothing is rasterized into the result).
 *  2. Binarize rows into "ink" pixels and group consecutive inky rows into
 *     thin horizontal BANDS.
 *  3. A dotted/dashed separator band has a very specific signature that
 *     separates it from everything else on the page:
 *       - THIN (a few px tall)            -> excludes text lines, barcodes, QR blocks
 *       - MANY ink segments per row       -> excludes solid rules/borders (2 transitions)
 *       - WIDE span across the page       -> excludes short underlines, table fragments
 *       - MODERATE ink density            -> excludes solid bars (too dense)
 *       - REGULAR dash rhythm             -> excludes full-width tiny text
 *         (dash lengths cluster around one size; text mixes thin stems,
 *          wide glyphs and big word gaps, so its run-length variance is high)
 *  4. As an extra guard, the text layer is scanned for a "Tax Invoice"
 *     heading (which always sits BELOW the separator). Candidates below that
 *     heading are discarded — but the heading is only a filter, the LINE
 *     itself is always the crop boundary.
 *  5. The crop keeps the full page width, from the top down to just ABOVE
 *     the separator (small margin), so the dotted line itself is excluded.
 *
 * If no separator is found on a page, that page is kept FULL SIZE and
 * reported — never silently mis-cropped.
 */

import { PDFDocument } from "pdf-lib";
import { cropPdfPerPage } from "./crop";
import {
  renderPageToImageData,
  getPageTextLines,
  type PageTextLine,
} from "./render";
import type { CropRect } from "./platform-defaults";

// ---------------------------------------------------------------------------
// Tunables (all relative, so they work at any page size / render scale)
// ---------------------------------------------------------------------------

/** Bitmap width used for detection. ~1.5x of a 595pt page: dashes resolve. */
const DETECT_WIDTH = 900;
/** Luminance below this counts as ink. */
const INK_LUMA = 140;
/** A row counts as "inky" when this fraction of its pixels are ink. */
const ROW_MIN_INK_FRAC = 0.04;
/** Blank-ish rows tolerated INSIDE one band (anti-aliasing gaps). */
const BAND_GAP_ROWS = 2;
/** Max band thickness in px (at DETECT_WIDTH). Excludes text/barcodes. */
const BAND_MAX_HEIGHT = 10;
/** Min dark runs per row (avg). A solid rule has ~1; a dotted line has many. */
const BAND_MIN_RUNS = 6;
/** Min horizontal span as a fraction of page width. */
const BAND_MIN_SPAN = 0.55;
/** Ink density bounds inside the band box. Excludes solid bars. */
const BAND_DENSITY_MIN = 0.06;
const BAND_DENSITY_MAX = 0.8;
/** Ignore the very top/bottom edges (letterhead rules, footers). */
const SEARCH_TOP = 0.08;
const SEARCH_BOTTOM = 0.92;
/** "Tax Invoice" matches above this height are label print — ignore them. */
const TAX_ANCHOR_MIN_Y = 0.3;
/** Gap kept above the separator so the dotted line itself is excluded. */
const CUT_MARGIN_NORM = 0.012;
/** Min runs needed for the rhythm check. */
const RHYTHM_MIN_RUNS = 8;

// ---------------------------------------------------------------------------
// Pure row/band analysis (no DOM, no pdf.js — unit-testable)
// ---------------------------------------------------------------------------

export interface RowStat {
  y: number;
  ink: number;
  /** number of dark runs (dash segments) in this row */
  runs: number;
  first: number;
  last: number;
}

export function computeRowStats(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): RowStat[] {
  const stats: RowStat[] = [];
  for (let y = 0; y < height; y++) {
    let ink = 0;
    let runs = 0;
    let first = -1;
    let last = -1;
    let inRun = false;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const o = (rowOff + x) * 4;
      // Luminance; canvas was pre-filled white so alpha is opaque.
      const lum = 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
      const isInk = lum < INK_LUMA;
      if (isInk) {
        ink++;
        if (first < 0) first = x;
        last = x;
        if (!inRun) {
          runs++;
          inRun = true;
        }
      } else {
        inRun = false;
      }
    }
    stats.push({ y, ink, runs, first, last });
  }
  return stats;
}

export interface Band {
  top: number;
  bottom: number; // inclusive row
  rows: RowStat[];
}

/** Group consecutive inky rows into bands, tolerating tiny gaps. */
export function groupRowsIntoBands(stats: RowStat[], width: number): Band[] {
  const bands: Band[] = [];
  let cur: Band | null = null;
  let gap = 0;
  const isInky = (r: RowStat) => r.ink / width >= ROW_MIN_INK_FRAC;
  for (const r of stats) {
    if (isInky(r)) {
      if (!cur) cur = { top: r.y, bottom: r.y, rows: [] };
      else if (gap > 0) cur.bottom = r.y;
      else cur.bottom = r.y;
      cur.rows.push(r);
      gap = 0;
    } else if (cur) {
      gap++;
      if (gap > BAND_GAP_ROWS) {
        bands.push(cur);
        cur = null;
        gap = 0;
      }
    }
  }
  if (cur) bands.push(cur);
  return bands;
}

function bandMetrics(band: Band, width: number) {
  const heightPx = band.bottom - band.top + 1;
  let first = width;
  let last = -1;
  let ink = 0;
  let runs = 0;
  for (const r of band.rows) {
    if (r.first >= 0 && r.first < first) first = r.first;
    if (r.last > last) last = r.last;
    ink += r.ink;
    runs += r.runs;
  }
  const spanPx = last >= first ? last - first + 1 : 0;
  return {
    heightPx,
    spanNorm: spanPx / width,
    avgRuns: runs / Math.max(1, band.rows.length),
    density: spanPx > 0 ? ink / (spanPx * heightPx) : 0,
  };
}

/** Dark + gap run lengths for a band, taken from its inkiest row. */
export interface BandRuns {
  dark: number[];
  /** white gaps strictly INSIDE the ink span (edge margins excluded) */
  gap: number[];
}

export function collectBandRowRuns(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  band: Band
): BandRuns {
  let row = band.rows[0].y;
  let bestInk = -1;
  for (const r of band.rows) {
    if (r.ink > bestInk) {
      bestInk = r.ink;
      row = r.y;
    }
  }
  const rowOff = row * width;
  const at = (x: number) => {
    const o = (rowOff + x) * 4;
    return 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
  };
  // Ink span of this row.
  let first = -1;
  let last = -1;
  for (let x = 0; x < width; x++) {
    if (at(x) < INK_LUMA) {
      if (first < 0) first = x;
      last = x;
    }
  }
  const dark: number[] = [];
  const gap: number[] = [];
  if (first < 0) return { dark, gap };
  let x = first;
  while (x <= last) {
    if (at(x) >= INK_LUMA) {
      let len = 0;
      while (x <= last && at(x) >= INK_LUMA) {
        len++;
        x++;
      }
      gap.push(len);
    } else {
      let len = 0;
      while (x <= last && at(x) < INK_LUMA) {
        len++;
        x++;
      }
      dark.push(len);
    }
  }
  return { dark, gap };
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / Math.max(1, nums.length);
}

function cv(nums: number[]): number {
  const m = avg(nums);
  if (m <= 0) return Infinity;
  const v = nums.reduce((s, n) => s + (n - m) * (n - m), 0) / nums.length;
  return Math.sqrt(v) / m;
}

/**
 * Rhythm check: dashes repeat at roughly ONE size with even gaps, while a
 * row of tiny text mixes thin stems, wide glyphs and small/large gaps.
 * Three cheap gates (dark uniformity, dark size ratio, gap regularity) that
 * real dashed rules pass with wide margin:
 *   - dark runs: many, short, uniform (cv < 0.8, max <= 4x min)
 *   - gaps: nearly as many as dashes, short, regular (cv < 1.0)
 * A scissors glyph or speckle adds a few outliers but rarely breaks all
 * three gates at once; tiny text almost always breaks at least two.
 */
export function isDashLike(runs: BandRuns, width: number): boolean {
  const dark = runs.dark.filter((d) => d >= 2);
  if (dark.length < RHYTHM_MIN_RUNS) return false;
  if (avg(dark) > 0.12 * width) return false; // dashes are short
  if (cv(dark) >= 0.8) return false;
  const minD = Math.min(...dark);
  const maxD = Math.max(...dark);
  if (maxD > 4 * minD) return false;
  const gap = runs.gap;
  if (gap.length < dark.length - 2) return false;
  if (avg(gap) > 0.12 * width) return false;
  if (cv(gap) >= 1.0) return false;
  return true;
}

/**
 * "Tax Invoice" heading = anchor that must sit BELOW the separator.
 * Only a filter — the detected LINE is always the crop boundary.
 * Matches high up on the page are label print (e.g. invoice refs) and are
 * ignored so they can't wrongly disqualify the real separator.
 */
export function findTaxAnchor(lines: PageTextLine[]): number | null {
  let topmost: number | null = null;
  for (const l of lines) {
    if (l.text.toLowerCase().includes("tax invoice")) {
      if (topmost === null || l.yTopNorm < topmost) topmost = l.yTopNorm;
    }
  }
  if (topmost === null || topmost < TAX_ANCHOR_MIN_Y) return null;
  return topmost;
}

export interface SeparatorHit {
  band: Band;
  /** normalized cut line (top origin), separator + margin already excluded */
  cutYNorm: number;
  spanNorm: number;
}

/**
 * Pick the separator band. Widest qualifying dotted band wins; ties break
 * towards the lower candidate (closest to the invoice side). Returns null
 * when nothing qualifies — the caller then keeps the full page.
 */
export function findSeparatorBand(
  stats: RowStat[],
  width: number,
  height: number,
  taxTopNorm: number | null,
  getRowRuns: (band: Band) => BandRuns
): SeparatorHit | null {
  const bands = groupRowsIntoBands(stats, width);
  let best: SeparatorHit | null = null;
  for (const band of bands) {
    const bandTopNorm = band.top / height;
    const bandBottomNorm = (band.bottom + 1) / height;
    // Stay clear of letterhead/footer zones.
    if (bandBottomNorm < SEARCH_TOP || bandTopNorm > SEARCH_BOTTOM) continue;
    // Must sit above the invoice heading (with a small gap).
    if (taxTopNorm !== null && bandBottomNorm > taxTopNorm - 0.005) continue;
    const m = bandMetrics(band, width);
    if (m.heightPx > BAND_MAX_HEIGHT) continue;
    if (m.avgRuns < BAND_MIN_RUNS) continue;
    if (m.spanNorm < BAND_MIN_SPAN) continue;
    if (m.density < BAND_DENSITY_MIN || m.density > BAND_DENSITY_MAX) continue;
    if (!isDashLike(getRowRuns(band), width)) continue;

    const cutYNorm = bandBottomNorm - CUT_MARGIN_NORM;
    if (cutYNorm < 0.12 || cutYNorm > 0.97) continue; // avoid slivers
    if (
      !best ||
      m.spanNorm > best.spanNorm ||
      (m.spanNorm === best.spanNorm && bandBottomNorm > best.band.bottom / height)
    ) {
      best = { band, cutYNorm, spanNorm: m.spanNorm };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FlipkartPageReport {
  pageNumber: number;
  detected: boolean;
  /** normalized separator position from top; null when not detected */
  separatorYNorm: number | null;
  cropped: boolean;
  reason?: string;
}

export interface FlipkartCropResult {
  pdf: Uint8Array;
  pages: FlipkartPageReport[];
  detectedCount: number;
  totalPages: number;
}

/**
 * Auto-crop a Flipkart shipping PDF: keep only the label ABOVE the dotted
 * separator on every page. Pages without a detectable separator are kept
 * full-size and reported (never silently mis-cropped).
 *
 * Reusable interface — Amazon/Meesho can get their own modules later:
 *   const { pdf, pages } = await cropFlipkartLabels(bytes, onProgress);
 */
export async function cropFlipkartLabels(
  input: Uint8Array,
  onProgress?: (done: number, total: number) => void
): Promise<FlipkartCropResult> {
  let doc;
  try {
    doc = await PDFDocument.load(input, { ignoreEncryption: true });
  } catch {
    throw new Error(
      "This PDF could not be opened. It may be corrupted or password-protected."
    );
  }
  const pdfPages = doc.getPages();
  if (pdfPages.length === 0) throw new Error("This PDF has no pages to process.");

  const rects: ({ x: number; y: number; width: number; height: number } | null)[] = [];
  const pages: FlipkartPageReport[] = [];

  // Pages are processed SEQUENTIALLY: bounded memory, clean progress.
  for (let i = 0; i < pdfPages.length; i++) {
    const pageNumber = i + 1;
    const rotation = ((pdfPages[i].getRotation().angle % 360) + 360) % 360;
    if (rotation !== 0) {
      // Coordinate mapping assumes upright pages — keep rotated ones intact.
      rects.push(null);
      pages.push({
        pageNumber,
        detected: false,
        separatorYNorm: null,
        cropped: false,
        reason: "rotated",
      });
      onProgress?.(pageNumber, pdfPages.length);
      continue;
    }
    try {
      // Text is auxiliary: a failure here must not block detection.
      const [img, textLines] = await Promise.all([
        renderPageToImageData({ data: input, pageNumber, targetWidth: DETECT_WIDTH }),
        getPageTextLines(input, pageNumber).catch((): PageTextLine[] => []),
      ]);
      const taxTop = findTaxAnchor(textLines);
      const stats = computeRowStats(img.pixels, img.width, img.height);
      const hit = findSeparatorBand(stats, img.width, img.height, taxTop, (band) =>
        collectBandRowRuns(img.pixels, img.width, band)
      );
      if (!hit) {
        rects.push(null);
        pages.push({
          pageNumber,
          detected: false,
          separatorYNorm: null,
          cropped: false,
          reason: "no-separator",
        });
      } else {
        const separatorYNorm = (hit.band.bottom + 1) / img.height;
        rects.push({ x: 0, y: 0, width: 1, height: hit.cutYNorm });
        pages.push({
          pageNumber,
          detected: true,
          separatorYNorm,
          cropped: true,
        });
      }
    } catch (err) {
      // A per-page analysis failure degrades to "not detected", never a crash.
      console.error(`[flipkart] detection failed on page ${pageNumber}:`, err);
      rects.push(null);
      pages.push({
        pageNumber,
        detected: false,
        separatorYNorm: null,
        cropped: false,
        reason: "analysis-failed",
      });
    }
    onProgress?.(pageNumber, pdfPages.length);
  }

  let pdf: Uint8Array;
  try {
    pdf = await cropPdfPerPage(input, rects);
  } catch {
    throw new Error("Could not generate the cropped PDF. Please retry.");
  }

  return {
    pdf,
    pages,
    detectedCount: pages.filter((p) => p.detected).length,
    totalPages: pages.length,
  };
}
