import type { Platform } from "./platform-defaults";

export interface PlatformDetection {
  platform: Exclude<Platform, "manual"> | null;
  basis: "text-match" | "fallback" | "mixed" | "no-text" | "unavailable";
}

/** Match known words even when a PDF splits their letters into text items. */
export function platformFromText(text: string): PlatformDetection {
  const normalized = text.normalize("NFKC").replace(/[\u00ad\u200b-\u200d\ufeff]/g, "").toLowerCase();
  if (!normalized.trim()) return { platform: null, basis: "no-text" };
  const flipkart = /\bf\s*l\s*i\s*p\s*k\s*a\s*r\s*t\b/.test(normalized)
    || /\be[\s\-\u2010-\u2015]*k\s*a\s*r\s*t\b/.test(normalized);
  const amazon = /\ba\s*m\s*a\s*z\s*o\s*n\b/.test(normalized);
  if (flipkart && amazon) return { platform: null, basis: "mixed" };
  if (flipkart) return { platform: "flipkart", basis: "text-match" };
  if (amazon) return { platform: "amazon", basis: "text-match" };
  const meesho = /\bm\s*e\s*e\s*s\s*h\s*o\b/.test(normalized);
  return { platform: "meesho", basis: meesho ? "text-match" : "fallback" };
}

/** Read a bounded sample using one PDF worker document; never uploads the PDF. */
export async function detectPdfPlatform(data: Uint8Array, signal?: AbortSignal): Promise<PlatformDetection> {
  const unavailable: PlatformDetection = { platform: null, basis: "unavailable" };
  if (signal?.aborted) return unavailable;
  const controller = new AbortController();
  let stop = () => {};
  const interrupted = new Promise<PlatformDetection>((resolve) => {
    stop = () => { controller.abort(); resolve(unavailable); };
  });
  signal?.addEventListener("abort", stop, { once: true });
  // Optional detection must not hold a valid upload indefinitely.
  const timeout = setTimeout(stop, 5000);
  try {
    const detect = (async () => {
      const { getPdfSampleText } = await import("./render");
      if (controller.signal.aborted) return unavailable;
      return platformFromText(await getPdfSampleText(data, controller.signal));
    })().catch(() => unavailable);
    return await Promise.race([detect, interrupted]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", stop);
  }
}
