import SiteHeader from "@/components/ui/SiteHeader";
import { Spinner } from "@/components/ui/primitives";

export default function CropLoading() {
  return (
    <div className="min-h-screen">
      <SiteHeader title="Loading…" subtitle="Preparing the upload screen." />
      <main className="container-x py-8">
        <div className="card mx-auto flex max-w-2xl items-center justify-center px-6 py-16">
          <Spinner label="Loading…" />
        </div>
      </main>
    </div>
  );
}
