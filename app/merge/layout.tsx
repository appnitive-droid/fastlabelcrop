import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge PDFs Online — Combine Multiple PDFs into One",
  description:
    "Free online PDF merger: combine invoices, shipping labels and manifests into one print-ready PDF. Reorder with drag & drop — 100% in-browser, private, no uploads.",
  alternates: {
    canonical: "/merge",
  },
  openGraph: {
    title: "Merge PDFs Online — Combine Multiple PDFs into One | Fastlabelcrop",
    description:
      "Combine invoices, shipping labels and manifests into one print-ready PDF. Free, private and 100% in-browser.",
    url: "/merge",
  },
  twitter: {
    card: "summary",
    title: "Merge PDFs Online — Combine Multiple PDFs into One | Fastlabelcrop",
    description:
      "Combine invoices, shipping labels and manifests into one print-ready PDF. Free, private and 100% in-browser.",
  },
};

export default function MergeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
