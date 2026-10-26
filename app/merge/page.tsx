import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import MergeWorkspace from "@/components/merge/MergeWorkspace";
import ToolGuide from "@/components/seo/ToolGuide";

export default function MergePage() {
  return <div className="min-h-screen">
    <SiteHeader title="Merge PDFs" subtitle="Combine multiple PDF files into one document and arrange them in the order you want." />
    <main className="container-x py-8"><MergeWorkspace /><ToolGuide tool="merge" /></main>
    <SiteFooter />
  </div>;
}
