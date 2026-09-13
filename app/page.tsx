import type { Metadata } from "next";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import { Hero, PlatformCards, MergePromoCard, TrustRow } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Fastlabelcrop — Crop Shipping Labels & Merge PDFs Online",
  description:
    "Free online tool for e-commerce sellers to crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs. Fast, private and 100% in-browser — no uploads.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Fastlabelcrop — Crop Shipping Labels & Merge PDFs Online",
    description:
      "Crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs online. Free, fast and private.",
    url: "/",
  },
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-x pb-4">
        <Hero />
        <p className="label-xs mt-8">Crop labels</p>
        <PlatformCards />
        <p className="label-xs mt-10">Combine documents</p>
        <MergePromoCard />
        <TrustRow />
      </main>
      <SiteFooter />
    </div>
  );
}
