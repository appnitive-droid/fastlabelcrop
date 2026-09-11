import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import { Hero, PlatformCards, MergePromoCard, TrustRow } from "@/components/dashboard/dashboard";

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
