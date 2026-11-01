/** 시각 문자열(ISO 8601)을 시각으로 비교한다. 오름차순이고 없는 시각이 맨 앞이다. 내림차순은 인자를 바꿔 부른다. */
// Postgres writes a timestamptz without a zero fraction ("…:00+00:00" next to "…:00.5+00:00"), and
// localeCompare puts "." before "+", so the strings sort out of time order within one second.
export function compareTimestamps(a: string | null, b: string | null): number {
  const at = a ? Date.parse(a) : -Infinity;
  const bt = b ? Date.parse(b) : -Infinity;
  return at === bt ? 0 : at < bt ? -1 : 1;
}
