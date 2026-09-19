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
