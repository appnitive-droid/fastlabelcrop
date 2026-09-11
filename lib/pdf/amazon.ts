/**
 * Amazon label extraction (page SELECTION, not cropping).
 *
 * Amazon generates PDFs with pages arranged as alternating pairs:
 *   Page 1 → Shipping Label      (pageIndex 0)
 *   Page 2 → Invoice             (pageIndex 1)
 *   Page 3 → Shipping Label      (pageIndex 2)
 *   Page 4 → Invoice             ...
 * and so on. Odd-positioned (1-based) pages are labels.
 *
 * Two modes:
 *  - "labels":  keep pages where pageIndex % 2 === 0, in original order.
 *               Label pages are copied untouched — never cropped, never
 *               rasterized — so barcodes/QR/text stay pixel-perfect.
 *  - "all":     return the original PDF byte-for-byte (no re-save, which
 *               would needlessly rewrite the file).
 *
 * No separator detection, no content sniffing: the alternating layout IS
 * the rule. Works for 1 page, pairs, and odd totals (a trailing odd page
 * is a label by the same rule).
 */

import { PDFDocument } from "pdf-lib";

export interface AmazonProcessResult {
  pdf: Uint8Array;
  totalPages: number;
  /** 1-based page numbers kept, in output order */
  keptPages: number[];
  /** 1-based page numbers removed */
  removedPages: number[];
  /** true when the original was returned unchanged ("Labels + Invoices") */
  unchanged: boolean;
}

export async function processAmazonPdf(
  input: Uint8Array,
  keepInvoices: boolean
): Promise<AmazonProcessResult> {
  let src: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    src = await PDFDocument.load(input, { ignoreEncryption: true });
  } catch {
    throw new Error(
      "This PDF could not be opened. It may be corrupted or password-protected."
    );
  }

  const totalPages = src.getPageCount();
  if (totalPages === 0) throw new Error("This PDF has no pages to process.");

  const keptPages: number[] = [];
  const removedPages: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    (i % 2 === 0 ? keptPages : removedPages).push(i + 1);
  }

  if (keepInvoices) {
    // Deliberately return the ORIGINAL bytes — no re-save, no changes.
    return { pdf: input, totalPages, keptPages, removedPages, unchanged: true };
  }

  const out = await PDFDocument.create();
  try {
    // keptPages are 1-based; copyPages wants 0-based indices (already ordered).
    const pages = await out.copyPages(
      src,
      keptPages.map((p) => p - 1)
    );
    pages.forEach((p) => out.addPage(p));
  } catch {
    throw new Error("Could not extract the label pages. Please retry.");
  }

  try {
    const pdf = await out.save();
    return { pdf, totalPages, keptPages, removedPages, unchanged: false };
  } catch {
    throw new Error("Could not generate the labels PDF. Please retry.");
  }
}
