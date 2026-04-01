const INVIDIOUS_INSTANCES = [
  "https://vid.puffyan.us",
  "https://invidious.fdn.fr",
  "https://yewtu.be",
];

const SEARCH_TIMEOUT_MS = 3000;

export interface SearchResult {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  lengthSeconds: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export { formatDuration };

export async function searchVideos(
  query: string
): Promise<SearchResult[] | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

      const url = `${instance}/api/v1/search?q=${encodeURIComponent(trimmed)}&type=video`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);

      if (!res.ok) continue;

      const data = await res.json();

      if (!Array.isArray(data)) continue;

      const results: SearchResult[] = data
        .filter(
          (item: { type?: string; videoId?: string }) =>
            item.type === "video" && item.videoId
        )
        .slice(0, 8)
        .map(
          (item: {
            videoId: string;
            title: string;
            author: string;
            videoThumbnails?: { url: string; quality: string }[];
            lengthSeconds: number;
          }) => ({
            videoId: item.videoId,
            title: item.title || "제목 없음",
            author: item.author || "",
            thumbnail: `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
            lengthSeconds: item.lengthSeconds || 0,
          })
        );

      return results;
    } catch {
      // Try next instance
      continue;
    }
  }

  // All instances failed
  return null;
}
