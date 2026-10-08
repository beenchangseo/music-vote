import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Room pages (/playlist/*) are private links and stay out of the sitemap;
// the page itself also sets robots noindex.
//
// lastModified is when the page's content last changed, not the request time — a date that
// moves on every crawl tells search engines nothing. Bump it when you change a page's text.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: "2026-10-08", changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: "2026-10-05", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guide`, lastModified: "2026-10-05", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified: "2026-10-05", changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: "2026-10-05", changeFrequency: "yearly", priority: 0.3 },
  ];
}
