#!/usr/bin/env node
// 공개 anon 키로 무엇을 할 수 있는지 점검한다. 읽기만 하고 아무것도 바꾸지 않는다.
//
//   node scripts/audit-anon-access.mjs
//
// v15 적용 전에는 votes 직접 조회가 뚫려 있고, 적용 후에는 막혀야 한다.
// 브라우저에 노출되는 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 그대로 쓴다.

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

const anon = createClient(url, anonKey);
let failures = 0;

function report(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`${ok ? "  통과" : "  실패"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("공개 anon 키 접근 점검\n");

console.log("막혀 있어야 하는 것");
const votes = await anon.from("votes").select("nickname, vote_type").limit(1);
report(
  "votes 직접 조회",
  !!votes.error || (votes.data?.length ?? 0) === 0,
  votes.error ? votes.error.code : `${votes.data.length}건 노출`,
);

console.log("\n열려 있어야 하는 것");
for (const view of ["song_vote_summary", "song_voters", "playlist_stats", "home_stats"]) {
  const result = await anon.from(view).select("*").limit(1);
  report(`뷰 ${view}`, !result.error, result.error?.code);
}

const playlists = await anon.from("playlists").select("id").limit(1);
report("playlists 조회", !playlists.error, playlists.error?.code);

console.log(failures === 0 ? "\n모두 통과했습니다." : `\n${failures}건이 기대와 다릅니다.`);
process.exit(failures === 0 ? 0 : 1);
