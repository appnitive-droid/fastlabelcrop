import type { CropRect, Platform } from "./platform-defaults";
import { defaultKeepInvoices, PLATFORM_DEFAULTS } from "./platform-defaults";
import type { FlipkartCropResult } from "./flipkart";
import type { PlatformDetection } from "./detect-platform";

export interface AdvancedItem {
  id: string;
  file: File;
  data: Uint8Array;
  platform: Platform | "";
  keepInvoices: boolean;
  rect: CropRect | null;
  reviewed: boolean;
  manualOverride: boolean;
  readable: boolean;
  pageCount: number;
  status: "pending" | "processing" | "attention" | "ready";
  output: Uint8Array | null;
  outputName?: string;
  outputPages?: number;
  warning?: string;
  report?: FlipkartCropResult["pages"];
  detection?: PlatformDetection;
}

export function needsCropReview(item: AdvancedItem): boolean {
  if (item.platform === "meesho" && item.keepInvoices) return false;
  return item.manualOverride || item.platform === "meesho" || item.platform === "manual";
}

export function changeAdvancedSettings(item: AdvancedItem, patch: Partial<AdvancedItem>): AdvancedItem {
  const next = { ...item, ...patch };
  if (patch.platform !== undefined) {
    next.keepInvoices = defaultKeepInvoices(patch.platform);
  }
  if (patch.platform !== undefined || patch.keepInvoices !== undefined) {
    next.rect = next.platform ? PLATFORM_DEFAULTS[next.platform] : null;
    next.reviewed = false;
    next.manualOverride = false;
  }
  return {
    ...next, status: "pending", output: null, outputName: undefined,
    outputPages: undefined, warning: undefined, report: undefined,
  };
}

export function canProcess(item: AdvancedItem): boolean {
  return Boolean(item.platform) && (!item.readable || !needsCropReview(item) || item.reviewed);
}

/** Process one immutable input; the caller owns cancellation and UI state. */
export async function processAdvancedItem(
  item: AdvancedItem,
  signal?: AbortSignal
): Promise<AdvancedItem> {
  if (!canProcess(item)) throw new Error("Choose a marketplace and review the crop first.");
  const checkCancelled = () => { if (signal?.aborted) throw new DOMException("Cancelled", "AbortError"); };
  checkCancelled();
  const { PDFDocument } = await import("pdf-lib");
  checkCancelled();
  const source = await PDFDocument.load(item.data);
  checkCancelled();
  const pageCount = source.getPageCount();
  if (!pageCount) throw new Error("This PDF has no pages.");
  let output: Uint8Array;
  let report: AdvancedItem["report"];
  let warning: string | undefined;
  let outputPages = pageCount;
  let unchanged = false;
  if (item.platform === "meesho" && item.keepInvoices) {
    output = item.data;
    unchanged = true;
  } else if (needsCropReview(item)) {
    if (!item.rect || !item.reviewed) throw new Error("Review the crop for this PDF first.");
    const { cropPdf } = await import("./crop");
    checkCancelled();
    output = await cropPdf(item.data, item.rect);
  } else if (item.platform === "amazon") {
    const { processAmazonPdf } = await import("./amazon");
    checkCancelled();
    const result = await processAmazonPdf(item.data, item.keepInvoices);
    output = result.pdf;
    unchanged = result.unchanged;
    outputPages = unchanged ? pageCount : result.keptPages.length;
  } else if (item.platform === "flipkart") {
    const { cropFlipkartLabels } = await import("./flipkart");
    checkCancelled();
    const result = await cropFlipkartLabels(item.data, undefined, signal);
    output = result.pdf;
    report = result.pages;
    const unresolved = report.filter((p) => !p.detected).length;
    if (unresolved) warning = `${unresolved} of ${pageCount} pages could not be cropped automatically. Retry, crop this PDF manually, remove it, or explicitly keep the original unchanged.`;
  } else {
    throw new Error("Choose a marketplace for this PDF.");
  }
  checkCancelled();
  return {
    ...item, readable: true, pageCount, output, outputPages, report, warning,
    outputName: unchanged ? item.file.name : item.file.name.replace(/\.pdf$/i, "") + "-cropped.pdf",
    status: warning ? "attention" : "ready",
  };
}

export function keepOriginal(item: AdvancedItem): AdvancedItem {
  if (!item.readable) throw new Error("This PDF must be readable before it can be merged.");
  return {
    ...item, output: item.data, outputName: item.file.name, outputPages: item.pageCount,
    status: "ready", warning: undefined,
  };
}
