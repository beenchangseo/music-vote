import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://plypick.kr";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/guide`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const supabase = createAdminClient();
    const { data: playlists } = await supabase
      .from("playlists")
      .select("share_code, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    const playlistPages: MetadataRoute.Sitemap = (playlists ?? []).map((p) => ({
      url: `${baseUrl}/playlist/${p.share_code}`,
      lastModified: new Date(p.created_at),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...playlistPages];
  } catch {
    return staticPages;
  }
}
