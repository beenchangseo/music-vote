/** Postgres uuid 형식인지. 형식이 아닌 id 로 DB 를 물으면 22P02 로 실패하니 묻기 전에 거른다. */
export function isUuidFormat(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
