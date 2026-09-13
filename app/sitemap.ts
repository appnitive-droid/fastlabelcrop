import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/crop/amazon", changeFrequency: "monthly", priority: 0.8 },
    { path: "/crop/flipkart", changeFrequency: "monthly", priority: 0.8 },
    { path: "/crop/meesho", changeFrequency: "monthly", priority: 0.8 },
    { path: "/crop/manual", changeFrequency: "monthly", priority: 0.7 },
    { path: "/merge", changeFrequency: "monthly", priority: 0.8 },
  ];

  return pages.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
