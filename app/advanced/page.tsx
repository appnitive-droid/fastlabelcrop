import type { Metadata } from "next";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import AdvancedFlow from "@/components/crop/AdvancedFlow";

export const metadata: Metadata = {
  title: "Advanced Cropping — Crop & Merge PDFs",
  description: "Crop shipping labels from mixed marketplaces, arrange your PDFs, and merge them in your browser.",
  alternates: { canonical: "/advanced" },
};

export default function AdvancedPage() {
  return <div className="min-h-screen">
    <SiteHeader title="Advanced Cropping" subtitle="Crop labels from different marketplaces and merge them into one print-ready PDF." />
    <main className="container-x py-8"><AdvancedFlow /></main>
    <SiteFooter />
  </div>;
}
