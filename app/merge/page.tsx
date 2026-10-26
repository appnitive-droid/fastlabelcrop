import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import MergeWorkspace from "@/components/merge/MergeWorkspace";

export default function MergePage() {
  return <div className="min-h-screen">
    <SiteHeader title="Merge PDFs" subtitle="Combine multiple PDF files into one document and arrange them in the order you want." />
    <main className="container-x py-8"><MergeWorkspace /></main>
    <SiteFooter />
  </div>;
}
