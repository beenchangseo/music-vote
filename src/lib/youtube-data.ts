/**
 * YouTube Data API v3 — 영상 상세 조회.
 *
 * oEmbed 는 제목과 썸네일만 준다. 재생시간은 여기서만 얻을 수 있다.
 * videos.list 는 한 번에 50개까지 묶어 조회할 수 있고 비용이 낮다.
 * 하루 100회 전용 쿼터가 걸린 search.list 와는 다르다.
 *
 * 키가 없으면 조용히 빈 결과를 돌려준다. 곡 추가 자체를 막지 않는다.
 */

const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const MAX_IDS_PER_CALL = 50;
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export interface VideoDetails {
  videoId: string;
  /** 초. 길이를 알 수 없거나 라이브면 null. */
  durationSeconds: number | null;
  /**
   * 업로더가 임베드를 허용했는지.
   * true 라도 플랫폼 정책이나 Content ID 클레임으로 재생이 막힐 수 있다.
   * 재생 보장이 아니라 "명백히 불가인 곡"을 거르는 용도다.
   */
  embeddable: boolean;
}

/**
 * ISO 8601 duration 을 초로 바꾼다.
 * `PT4M13S`, `PT1H2M3S`, `P1DT2H` 형태를 처리한다.
 * 길이가 0 이면 null 을 돌려준다. 진행 중인 라이브가 `P0D` 로 온다.
 */
export function parseIsoDuration(iso: string): number | null {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    iso.trim(),
  );
  if (!match) return null;

  const [, weeks, days, hours, minutes, seconds] = match;
  const total =
    (Number(weeks) || 0) * 604800 +
    (Number(days) || 0) * 86400 +
    (Number(hours) || 0) * 3600 +
    (Number(minutes) || 0) * 60 +
    Math.round(Number(seconds) || 0);

  return total > 0 ? total : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * 영상 여러 개의 상세를 한 번에 조회한다.
 * 키가 없거나 호출이 실패하면 그 묶음은 건너뛴다. 던지지 않는다.
 */
export async function fetchVideoDetails(
  videoIds: string[],
): Promise<Map<string, VideoDetails>> {
  const result = new Map<string, VideoDetails>();
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return result;

  const ids = [...new Set(videoIds.filter((id) => VIDEO_ID_RE.test(id)))];
  if (ids.length === 0) return result;

  for (const group of chunk(ids, MAX_IDS_PER_CALL)) {
    const url = `${VIDEOS_ENDPOINT}?part=contentDetails,status&id=${group.join(",")}&key=${apiKey}`;
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.items ?? []) {
        const duration = item?.contentDetails?.duration;
        result.set(item.id, {
          videoId: item.id,
          durationSeconds: typeof duration === "string" ? parseIsoDuration(duration) : null,
          embeddable: item?.status?.embeddable !== false,
        });
      }
    } catch {
      // 네트워크 실패로 곡 추가를 막지 않는다.
    }
  }

  return result;
}

/** 영상 하나의 상세. 없으면 null. */
export async function fetchSingleVideoDetails(
  videoId: string,
): Promise<VideoDetails | null> {
  const map = await fetchVideoDetails([videoId]);
  return map.get(videoId) ?? null;
}

// ============================================================
// 검색
// ============================================================

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const SEARCH_MAX_RESULTS = 8;

export interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number | null;
}

export type SearchOutcome =
  | { status: "ok"; results: SearchResult[] }
  | { status: "no_key" }
  | { status: "quota_exceeded" }
  | { status: "failed" };

/** search.list 의 snippet 은 `&amp;` `&#39;` 같은 엔티티를 그대로 준다. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * 곡 이름으로 영상을 찾는다.
 *
 * search.list 는 하루 100회 전용 쿼터라 호출 하나가 비싸다. 호출부에서
 * 반드시 캐시를 거칠 것. 키 입력마다 부르면 안 된다.
 *
 * videoEmbeddable=true 로 임베드 불가 영상을 미리 걸러 합주 중에 재생되지
 * 않는 곡이 후보에 오르지 않게 한다.
 */
export async function searchVideos(query: string): Promise<SearchOutcome> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { status: "no_key" };

  const trimmed = query.trim();
  if (!trimmed) return { status: "ok", results: [] };

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(SEARCH_MAX_RESULTS),
    q: trimmed,
    key: apiKey,
  });

  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?${params}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return { status: "quota_exceeded" };
      }
      return { status: "failed" };
    }

    const data = await res.json();
    const items = (data.items ?? []).filter((i: { id?: { videoId?: string } }) => i?.id?.videoId);
    if (items.length === 0) return { status: "ok", results: [] };

    // 길이는 search.list 가 주지 않는다. videos.list 로 한 번 더 묶어 받는다(1 유닛).
    const details = await fetchVideoDetails(
      items.map((i: { id: { videoId: string } }) => i.id.videoId),
    );

    const results: SearchResult[] = items.map(
      (item: {
        id: { videoId: string };
        snippet: { title: string; channelTitle: string; thumbnails?: Record<string, { url: string }> };
      }) => {
        const videoId = item.id.videoId;
        const thumbs = item.snippet.thumbnails ?? {};
        return {
          videoId,
          title: decodeHtmlEntities(item.snippet.title ?? ""),
          channel: decodeHtmlEntities(item.snippet.channelTitle ?? ""),
          thumbnail:
            thumbs.medium?.url ?? thumbs.default?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          durationSeconds: details.get(videoId)?.durationSeconds ?? null,
        };
      },
    );

    return { status: "ok", results };
  } catch {
    return { status: "failed" };
  }
}
