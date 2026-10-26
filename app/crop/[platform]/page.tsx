import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import ToolGuide from "@/components/seo/ToolGuide";
import SiteHeader, { SiteFooter } from "@/components/ui/SiteHeader";
import { Spinner } from "@/components/ui/primitives";
import {
  PLATFORM_META,
  isPlatform,
  platformLogo,
  type Platform,
} from "@/lib/pdf/platform-defaults";

export function generateStaticParams() {
  return [
    { platform: "amazon" },
    { platform: "flipkart" },
    { platform: "meesho" },
    { platform: "manual" },
  ];
}

const CROP_METADATA: Record<Platform, { title: string; description: string }> = {
  amazon: {
    title: "Crop Amazon Shipping Labels from PDF Online",
    description:
      "Free online tool to crop Amazon shipping labels from your PDF — labels on odd pages, invoices on even. Extract print-ready labels in-browser. Private, no uploads.",
  },
  flipkart: {
    title: "Free Flipkart Label Cropper Online",
    description:
      "Crop Flipkart shipping label PDFs for free. Automatically detect the label-invoice separator and download cropped labels. No sign-up or server uploads.",
  },
  meesho: {
    title: "Crop Meesho Shipping Labels from PDF Online",
    description:
      "Keep the invoice in your Meesho PDF, or crop the shipping label for printing. Private, in-browser, no uploads.",
  },
  manual: {
    title: "Manual Crop — Crop Any Shipping Label or PDF Online",
    description:
      "Free online manual crop tool for any shipping label PDF or marketplace — draw the crop box yourself and download a print-ready PDF. Private, in-browser, no uploads.",
  },
};

export function generateMetadata({
  params,
}: {
  params: { platform: string };
}): Metadata {
  const slug = params.platform?.toLowerCase() || "";
  if (!isPlatform(slug)) {
    notFound();
  }
  const platform = slug as Platform;
  const meta = CROP_METADATA[platform];
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/crop/${platform}`,
    },
    openGraph: {
      title: `${meta.title} | Fastlabelcrop`,
      description: meta.description,
      url: `/crop/${platform}`,
    },
    twitter: {
      card: "summary",
      title: `${meta.title} | Fastlabelcrop`,
      description: meta.description,
    },
  };
}

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
  if (!isPlatform(slug)) notFound();
  if (params.platform !== slug) permanentRedirect(`/crop/${slug}`);
  const platform: Platform = slug;
  const meta = PLATFORM_META[platform];

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
          <ToolGuide tool={platform} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (platform === "flipkart") {
    return (
      <div className="min-h-screen">
        <SiteHeader
          title="Free Flipkart Label Cropper"
          subtitle="Upload your label PDF and get print-ready shipping labels."
          logoSrc={platformLogo(platform)}
          logoAlt="Flipkart"
        />
        <main className="container-x animate-fadeIn py-8">
          <FlipkartFlow />
          <ToolGuide tool={platform} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isManualGeneric = platform === "manual";
  const manualTitle = isManualGeneric ? "Manual Crop" : `Crop ${meta.name} Label`;
  const manualSubtitle = isManualGeneric
    ? "Upload any PDF and crop it manually before downloading."
    : "Upload your Meesho PDF and choose whether to keep the invoice or crop the shipping label.";

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
        <ToolGuide tool={platform} />
      </main>
      <SiteFooter />
    </div>
  );
}
