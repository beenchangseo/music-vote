export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?.*v=|m\.youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export interface VideoMetadata {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export async function fetchVideoMetadata(
  videoId: string
): Promise<VideoMetadata | null> {
  if (!VIDEO_ID_RE.test(videoId)) return null;
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: data.title ?? "제목 없음",
      author_name: data.author_name ?? null,
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch {
    return null;
  }
}
