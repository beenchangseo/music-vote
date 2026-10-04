// 탭 템포: 박자에 맞춰 누른 시각(ms)으로 BPM 을 낸다.
// BPM 자동 추출(Spotify audio-features)이 막혀서 "채우는 행위를 5초로" 줄이는 수단이다.

/** songs.tempo_bpm 이 받는 범위 (updateSongMeta·SongMeta 입력과 같다). */
export const MIN_BPM = 40;
export const MAX_BPM = 300;

/** 합주 화면이 BPM 을 채우기 시작하는 탭 수. */
export const TAPS_TO_FILL = 4;

/** 이보다 오래 멈추면 새 탭 묶음으로 본다 (30 BPM 보다 느림). */
export const TAP_RESET_MS = 2000;

/** 최근 탭만 센다. 템포가 흔들려도 금방 따라온다. */
const MAX_TAPS = 8;

/** 중앙값에서 이만큼 벗어난 간격은 놓친 박·헛 탭으로 보고 뺀다. */
const OUTLIER_RATIO = 0.25;

/** 탭 하나를 더한다. 간격이 TAP_RESET_MS 를 넘으면 새로 시작한다. */
export function addTap(taps: readonly number[], now: number): number[] {
  const last = taps[taps.length - 1];
  if (last === undefined || now - last > TAP_RESET_MS) return [now];
  if (now <= last) return [...taps];
  return [...taps, now].slice(-MAX_TAPS);
}

/**
 * 탭 시각 목록으로 BPM 을 낸다. 탭이 2번 미만이면 null.
 * 간격의 중앙값 근처만 평균 내고, 결과는 MIN_BPM~MAX_BPM 으로 자른다.
 */
export function bpmFromTaps(taps: readonly number[]): number | null {
  if (taps.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i += 1) intervals.push(taps[i] - taps[i - 1]);

  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (median <= 0) return null;

  const kept = intervals.filter((v) => Math.abs(v - median) <= median * OUTLIER_RATIO);
  const used = kept.length > 0 ? kept : [median];
  const mean = used.reduce((sum, v) => sum + v, 0) / used.length;

  const bpm = Math.round(60000 / mean);
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}
