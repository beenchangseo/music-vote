import { createClient } from "@supabase/supabase-js";

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
const bucketId = "setlist-posters";

if (!projectUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
}

const supabase = createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: bucket, error: lookupError } = await supabase.storage.getBucket(bucketId);
if (lookupError && !/not found/i.test(lookupError.message)) throw lookupError;

if (!bucket) console.log(`${bucketId}: 이미 삭제되어 있습니다.`);
if (bucket) {
  const { data: rootEntries, error: listError } = await supabase.storage.from(bucketId).list("", { limit: 1000 });
  if (listError) throw listError;
  console.log(`${bucketId}: 루트 항목 ${rootEntries.length}개를 확인했습니다.`);
}

const posterRows = await supabase.from("playlists").select("id", { count: "exact", head: true }).not("poster_url", "is", null);
const posterColumnMissing = posterRows.error && /poster_url|schema cache|column/i.test(posterRows.error.message);
if (posterRows.error && !posterColumnMissing) throw posterRows.error;
console.log(posterColumnMissing ? "poster_url: 이미 제거되어 있습니다." : `poster_url: 값이 남은 합주방 ${posterRows.count || 0}개를 확인했습니다.`);

if (!apply) {
  console.log("변경하지 않았습니다. 영구 삭제하려면 --apply를 붙이세요.");
  process.exit(0);
}

if (bucket) {
  const { error: emptyError } = await supabase.storage.emptyBucket(bucketId);
  if (emptyError) throw emptyError;
  let deleteError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ({ error: deleteError } = await supabase.storage.deleteBucket(bucketId));
    if (!deleteError) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (deleteError) throw deleteError;
}

if (!posterColumnMissing && (posterRows.count || 0) > 0) {
  const { error: clearError } = await supabase.from("playlists").update({ poster_url: null }).not("poster_url", "is", null);
  if (clearError) throw clearError;
}

const { data: remaining } = await supabase.storage.getBucket(bucketId);
if (remaining) throw new Error("버킷 삭제 후에도 대상이 남아 있습니다.");
console.log(`${bucketId}: 파일과 버킷을 영구 삭제했고, 남은 버킷이 없음을 확인했습니다.`);
if (!posterColumnMissing) {
  const { count, error } = await supabase.from("playlists").select("id", { count: "exact", head: true }).not("poster_url", "is", null);
  if (error) throw error;
  if (count !== 0) throw new Error("poster_url 값이 남아 있습니다.");
  console.log("poster_url: 남은 값 0개를 확인했습니다. 컬럼 자체는 v10 마이그레이션에서 제거합니다.");
}
