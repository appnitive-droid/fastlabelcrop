import type { Metadata } from "next";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import { Hero, PlatformCards, MergePromoCard, AdvancedPromoCard, TrustRow } from "@/components/dashboard/dashboard";
import ToolGuide from "@/components/seo/ToolGuide";

export const metadata: Metadata = {
  title: { absolute: "Free Shipping Label Cropper & PDF Merger | Fastlabelcrop" },
  description:
    "Free online tool for e-commerce sellers to crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs. Fast, private and 100% in-browser — no uploads.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Free Shipping Label Cropper & PDF Merger | Fastlabelcrop",
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
        <h2 className="label-xs mt-8">Crop shipping labels by marketplace</h2>
        <PlatformCards />
        <AdvancedPromoCard />
        <h2 className="label-xs mt-10">Combine documents</h2>
        <MergePromoCard />
        <TrustRow />
        <ToolGuide tool="home" />
      </main>
      <SiteFooter />
    </div>
  );
}
