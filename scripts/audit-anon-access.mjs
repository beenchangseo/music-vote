#!/usr/bin/env node
// 공개 anon 키로 무엇을 할 수 있는지 점검한다. 행을 만들거나 바꾸지 않는다.
//
//   node scripts/audit-anon-access.mjs     (package.json 에 등록되면: npm run audit:anon)
//
// 계약
//   - 아래 테이블은 anon 키로 행을 읽을 수 없어야 한다. 권한 오류(42501)나 0행이면 막힌 것으로 본다.
//     한 행이라도 돌아오면 실패다. 행 내용은 출력하지 않고 개수만 보여준다.
//   - playlists 에 anon INSERT 가 막혀 있어야 한다. 프로브는 NOT NULL 을 어기는 행을 보내므로
//     어느 쪽이든 행이 생기지 않는다. 막혀 있으면 42501, 정책이 열려 있으면 NOT NULL 위반(23502).
//   - 집계 뷰는 계속 열려 있어야 한다. SECURITY DEFINER 뷰라 테이블 권한을 회수해도 읽힌다.
//   - teams, team_members 는 v19 에서 생긴다. 테이블이 아직 없으면 건너뛴다.
//
// 브라우저에 노출되는 NEXT_PUBLIC_SUPABASE_ANON_KEY 만 쓴다. service_role 키는 쓰지 않는다.
// 키와 URL 은 출력하지 않는다. 하나라도 실패하면 종료 코드 1.
//
// 한계: 빈 테이블은 RLS 로 막힌 것과 0행이 똑같이 보인다. 출력의 "0행" 이 그 경우다.
//       쓰기 계약은 playlists INSERT 하나만 본다.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.");
  process.exit(1);
}

// 공개 키로 읽을 수 없어야 하는 테이블
const CLOSED_TABLES = [
  "playlists",
  "playlist_members",
  "songs",
  "comments",
  "setlist_items",
  "song_versions",
  "votes",
  "playlist_admin",
  "youtube_search_cache",
];
// v19 에서 만들어진다. 아직 없으면 건너뛴다.
const LATER_TABLES = ["teams", "team_members"];
// 계속 열려 있어야 하는 뷰
const OPEN_VIEWS = [
  "song_vote_summary",
  "song_voters",
  "song_engagement_counts",
  "playlist_stats",
  "home_stats",
];

// PostgREST 가 테이블을 못 찾을 때 돌려주는 코드(스키마 캐시 / Postgres undefined_table)
const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"]);

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
let failures = 0;

function report(label, status, detail) {
  if (status === "fail") failures += 1;
  const mark = { pass: "  통과", fail: "  실패", skip: "  건너뜀" }[status];
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
}

// 오류에서는 코드나 상태만 꺼낸다. 메시지에는 URL 같은 값이 섞일 수 있어 출력하지 않는다.
function errorId(error, status) {
  return error.code || `status ${status}`;
}

async function probeTable(table) {
  const { data, error, count, status } = await anon
    .from(table)
    .select("*", { count: "exact" })
    .limit(1);

  if (error) {
    if (error.code === "42501") return { kind: "blocked", detail: "권한 거부 42501" };
    if (MISSING_RELATION_CODES.has(error.code)) return { kind: "missing", detail: error.code };
    // 권한 오류가 아닌 오류(잘못된 키, 네트워크 등)는 막혔다는 증거가 못 된다.
    return { kind: "error", detail: `예상 밖 오류 ${errorId(error, status)}` };
  }

  const rows = data?.length ?? 0;
  if (rows > 0) return { kind: "open", detail: `${count ?? rows}행 노출` };
  return { kind: "blocked", detail: "0행 (RLS 로 막혔거나 빈 테이블)" };
}

console.log("공개 anon 키 접근 점검\n");

console.log("읽을 수 없어야 하는 것");
for (const table of CLOSED_TABLES) {
  const result = await probeTable(table);
  if (result.kind === "blocked") report(`${table} 조회`, "pass", result.detail);
  else if (result.kind === "missing") report(`${table} 조회`, "fail", `테이블이 없습니다 (${result.detail}) — 다른 DB 인가요?`);
  else report(`${table} 조회`, "fail", result.detail);
}

console.log("\nv19 이후에 생기는 것");
for (const table of LATER_TABLES) {
  const result = await probeTable(table);
  if (result.kind === "blocked") report(`${table} 조회`, "pass", result.detail);
  else if (result.kind === "missing") report(`${table} 조회`, "skip", "아직 만들어지지 않음");
  else report(`${table} 조회`, "fail", result.detail);
}

console.log("\n쓸 수 없어야 하는 것");
// title 을 null 로 보내 NOT NULL 을 어기게 한다. RLS·권한 검사가 먼저 돌므로 막혀 있으면 42501,
// 정책이 열려 있으면 23502 가 온다. 어느 쪽이든 행은 생기지 않는다.
const insertProbe = await anon.from("playlists").insert({ title: null });
if (insertProbe.error?.code === "42501") {
  report("playlists INSERT", "pass", "권한 거부 42501");
} else if (insertProbe.error?.code === "23502") {
  report("playlists INSERT", "fail", "insert 정책이 열려 있음 (23502)");
} else if (!insertProbe.error) {
  report("playlists INSERT", "fail", "오류 없이 통과 — 행이 만들어졌을 수 있습니다");
} else {
  report("playlists INSERT", "fail", `예상 밖 오류 ${errorId(insertProbe.error, insertProbe.status)}`);
}

console.log("\n열려 있어야 하는 것");
for (const view of OPEN_VIEWS) {
  const result = await anon.from(view).select("*").limit(1);
  report(`뷰 ${view}`, result.error ? "fail" : "pass", result.error ? errorId(result.error, result.status) : undefined);
}

console.log(failures === 0 ? "\n모두 통과했습니다." : `\n${failures}건이 기대와 다릅니다.`);
process.exit(failures === 0 ? 0 : 1);
