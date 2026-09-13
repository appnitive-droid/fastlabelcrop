import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Crop Shipping Labels & Merge PDFs Online`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Free online tool for e-commerce sellers to crop shipping labels from PDFs and merge PDFs. Works with Flipkart, Amazon and Meesho labels — 100% in-browser, private, no uploads.",
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Crop Shipping Labels & Merge PDFs Online`,
    description:
      "Crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs online. Free, fast and private — files never leave your browser.",
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Crop Shipping Labels & Merge PDFs Online`,
    description:
      "Crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs online. Free, fast and private.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              url: SITE_URL,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0" },
              description:
                "Free online tool for e-commerce sellers to crop Flipkart, Amazon and Meesho shipping labels from PDFs and merge PDFs entirely in the browser.",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
