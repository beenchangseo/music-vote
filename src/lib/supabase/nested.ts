/**
 * supabase-js 의 FK 중첩 select 결과를 배열로 편다.
 * 관계 방향에 따라 같은 키가 객체(다대일)·배열(일대다)·null(연결 없음)로 온다.
 */
export function nestedRows<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
