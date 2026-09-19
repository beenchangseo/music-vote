#!/usr/bin/env node
// 재생시간이 비어 있는 곡을 YouTube Data API 로 채운다.
//
//   node scripts/backfill-song-durations.mjs            # 무엇을 바꿀지만 보여준다
//   node scripts/backfill-song-durations.mjs --apply    # 실제로 저장한다
//
// videos.list 는 50개 묶음에 1 유닛이다. 곡 수백 개도 쿼터 부담이 없다.
// YOUTUBE_API_KEY 와 Supabase service role 키가 필요하다.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const apply = process.argv.includes("--apply");

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "YOUTUBE_API_KEY"]) {
  if (!env[key]) {
    console.error(`${key} 가 없습니다.`);
    process.exit(1);
  }
}

function parseIsoDuration(iso) {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso.trim());
  if (!m) return null;
  const [, w, d, h, min, s] = m;
  const total =
    (Number(w) || 0) * 604800 + (Number(d) || 0) * 86400 +
    (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + Math.round(Number(s) || 0);
  return total > 0 ? total : null;
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: songs, error } = await db
  .from("songs")
  .select("id, title, youtube_video_id, duration_seconds")
  .is("duration_seconds", null);

if (error) {
  console.error("곡 조회 실패:", error.message);
  process.exit(1);
}

console.log(`재생시간이 비어 있는 곡: ${songs.length}개\n`);
if (songs.length === 0) process.exit(0);

const ids = [...new Set(songs.map((s) => s.youtube_video_id).filter(Boolean))];
const details = new Map();

for (let i = 0; i < ids.length; i += 50) {
  const group = ids.slice(i, i + 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${group.join(",")}&key=${env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  API 호출 실패 (${res.status}):`, (await res.text()).slice(0, 200));
    continue;
  }
  const json = await res.json();
  for (const item of json.items ?? []) {
    details.set(item.id, {
      seconds: parseIsoDuration(item?.contentDetails?.duration ?? ""),
      embeddable: item?.status?.embeddable !== false,
    });
  }
  console.log(`  ${Math.min(i + 50, ids.length)}/${ids.length} 조회`);
}

let filled = 0, unknown = 0, blocked = 0;
const updates = [];

for (const song of songs) {
  const d = details.get(song.youtube_video_id);
  if (!d) { unknown += 1; continue; }
  if (!d.embeddable) blocked += 1;
  if (d.seconds == null) { unknown += 1; continue; }
  filled += 1;
  updates.push({ id: song.id, seconds: d.seconds, title: song.title });
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
console.log(`\n채울 수 있음 ${filled}개 · 알 수 없음 ${unknown}개 · 임베드 막힘 ${blocked}개`);
for (const u of updates.slice(0, 10)) console.log(`  ${fmt(u.seconds)}  ${u.title.slice(0, 50)}`);
if (updates.length > 10) console.log(`  ... 외 ${updates.length - 10}개`);

if (!apply) {
  console.log("\n미리보기입니다. 실제로 저장하려면 --apply 를 붙이세요.");
  process.exit(0);
}

let saved = 0;
for (const u of updates) {
  const { error: e } = await db.from("songs").update({ duration_seconds: u.seconds }).eq("id", u.id);
  if (e) console.error(`  실패 ${u.title.slice(0, 30)}: ${e.message}`);
  else saved += 1;
}
console.log(`\n${saved}개 저장했습니다.`);
