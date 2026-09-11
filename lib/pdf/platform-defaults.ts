export type Platform = "amazon" | "flipkart" | "meesho" | "manual";

export interface CropRect {
  /** 0..1, top-left origin, relative to page */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PLATFORM_META: Record<
  Platform,
  { name: string; description: string; accent: string }
> = {
  amazon: {
    name: "Amazon",
    description:
      "Labels on odd pages, invoices on even. Label pages are extracted automatically.",
    accent: "bg-amber-100 text-amber-800",
  },
  flipkart: {
    name: "Flipkart",
    description:
      "Label on top, Tax Invoice below. The dotted separator is auto-detected — no manual cropping needed.",
    accent: "bg-blue-100 text-blue-800",
  },
  meesho: {
    name: "Meesho",
    description:
      "Thermal / A4 label with sort-code header. We pre-select the scannable slip at the top.",
    accent: "bg-pink-100 text-pink-800",
  },
  manual: {
    name: "Custom",
    description:
      "Any other marketplace or PDF — draw the crop box yourself.",
    accent: "bg-slate-200 text-slate-700",
  },
};

/**
 * Sensible default crop rectangles (normalized, top-left origin).
 * Approximations based on typical label placement — user can adjust freely.
 */
export const PLATFORM_DEFAULTS: Record<Platform, CropRect> = {
  // Amazon: top ~52% of page, slight inset
  amazon: { x: 0.05, y: 0.03, width: 0.9, height: 0.52 },
  // Flipkart: slightly tighter top region
  flipkart: { x: 0.06, y: 0.04, width: 0.88, height: 0.48 },
  // Meesho: taller top slip
  meesho: { x: 0.05, y: 0.02, width: 0.9, height: 0.56 },
  // Manual / other: generous near-full-page box the user adjusts freely
  manual: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
};

export function isPlatform(v: string): v is Platform {
  return v === "amazon" || v === "flipkart" || v === "meesho" || v === "manual";
}

/** Brand logo served from /public; null for generic (manual) flow. */
export function platformLogo(p: Platform): string | null {
  return p === "manual" ? null : `/${p}.png`;
}

export function clampRect(r: CropRect): CropRect {
  const clamp = (n: number, lo = 0, hi = 1) =>
    Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));
  const x = clamp(r.x);
  const y = clamp(r.y);
  const width = Math.min(1 - x, Math.max(0.02, r.width || 0));
  const height = Math.min(1 - y, Math.max(0.02, r.height || 0));
  return { x, y, width, height };
}
