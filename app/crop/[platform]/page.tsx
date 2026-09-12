import dynamic from "next/dynamic";
import Link from "next/link";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import { Alert, Spinner } from "@/components/ui/primitives";
import {
  PLATFORM_META,
  isPlatform,
  platformLogo,
  type Platform,
} from "@/lib/pdf/platform-defaults";

function FlowLoading() {
  return (
    <div className="card mx-auto flex max-w-2xl items-center justify-center px-6 py-16">
      <Spinner label="Loading…" />
    </div>
  );
}

// Each flow (and its pdf-lib / preview code) loads only after the
// header + upload shell has painted — navigation feels instant.
const AmazonFlow = dynamic(() => import("@/components/crop/AmazonFlow"), {
  ssr: false,
  loading: () => <FlowLoading />,
});
const FlipkartFlow = dynamic(() => import("@/components/crop/FlipkartFlow"), {
  ssr: false,
  loading: () => <FlowLoading />,
});
const ManualFlow = dynamic(() => import("@/components/crop/ManualFlow"), {
  ssr: false,
  loading: () => <FlowLoading />,
});

export default function CropPlatformPage({ params }: { params: { platform: string } }) {
  const slug = params.platform?.toLowerCase() || "";
  const valid = isPlatform(slug);
  const platform: Platform = valid ? (slug as Platform) : "amazon";
  const meta = PLATFORM_META[platform];

  if (!valid) {
    return (
      <div className="min-h-screen">
        <SiteHeader title="Unknown platform" subtitle="That label type doesn't exist." />
        <main className="container-x py-12">
          <Alert
            title="Unknown label platform"
            message={`"${params.platform}" isn't a supported option. Choose Amazon, Flipkart, Meesho or Manual.`}
          />
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accent-700 hover:underline">
            ← Back to Dashboard
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (platform === "amazon") {
    return (
      <div className="min-h-screen">
        <SiteHeader
          title="Crop Amazon Label"
          subtitle="Upload your label PDF and choose what to keep — labels sit on odd pages, invoices on even."
          logoSrc={platformLogo(platform)}
          logoAlt="Amazon"
        />
        <main className="container-x animate-fadeIn py-8">
          <AmazonFlow />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (platform === "flipkart") {
    return (
      <div className="min-h-screen">
        <SiteHeader
          title="Crop Flipkart Label"
          subtitle="Upload your label PDF — we auto-detect the dotted separator and keep just the shipping label."
          logoSrc={platformLogo(platform)}
          logoAlt="Flipkart"
        />
        <main className="container-x animate-fadeIn py-8">
          <FlipkartFlow />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isManualGeneric = platform === "manual";
  const manualTitle = isManualGeneric ? "Manual Crop" : `Crop ${meta.name} Label`;
  const manualSubtitle = isManualGeneric
    ? "Upload any PDF and crop it manually before downloading."
    : "Upload your label PDF and crop it before downloading.";

  return (
    <div className="min-h-screen">
      <SiteHeader
        title={manualTitle}
        subtitle={manualSubtitle}
        logoSrc={platformLogo(platform)}
        logoAlt={meta.name}
      />
      <main className="container-x animate-fadeIn py-8">
        <ManualFlow platform={platform} />
      </main>
      <SiteFooter />
    </div>
  );
}
