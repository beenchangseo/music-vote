"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritable } from "@/lib/playlist-access";
import { searchVideos, type SearchResult } from "@/lib/youtube-data";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export type SearchSongsResult =
  | { status: "ok"; results: SearchResult[]; cached: boolean }
  | { status: "too_short" }
  | { status: "unavailable"; message: string };

/** 캐시 키. 같은 검색어가 다른 행으로 흩어지지 않게 맞춘다. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 곡 이름으로 YouTube 를 검색한다.
 *
 * search.list 는 하루 100회 전용 쿼터이고 전체 사용자 합산이다. 같은 검색어를
 * 24시간 캐시해 반복 호출을 없앤다. 화면에서는 반드시 명시적 검색(엔터/버튼)
 * 으로만 부를 것. 키 입력마다 부르면 한 사람이 하루치를 다 쓴다.
 */
export async function searchSongs(
  playlistId: string,
  query: string,
): Promise<SearchSongsResult> {
  const normalized = normalizeQuery(query);
  if (normalized.length < MIN_QUERY_LENGTH) return { status: "too_short" };
  if (normalized.length > MAX_QUERY_LENGTH) {
    return { status: "unavailable", message: "검색어가 너무 길어요." };
  }

  // 쿼터를 쓰는 동작이라 합주방 참여자만 부를 수 있게 한다.
  await assertPlaylistWritable(playlistId);
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const admin = createAdminClient();

  const { data: cached } = await admin
    .from("youtube_search_cache")
    .select("results, created_at")
    .eq("query", normalized)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    return { status: "ok", results: cached.results as SearchResult[], cached: true };
  }

  const outcome = await searchVideos(normalized);

  if (outcome.status === "no_key") {
    return {
      status: "unavailable",
      message: "검색이 아직 준비되지 않았어요. YouTube 링크를 붙여넣어 주세요.",
    };
  }
  if (outcome.status === "quota_exceeded") {
    // 캐시가 오래됐어도 없는 것보다 낫다.
    if (cached) {
      return { status: "ok", results: cached.results as SearchResult[], cached: true };
    }
    return {
      status: "unavailable",
      message: "오늘 검색 한도를 다 썼어요. YouTube 링크를 붙여넣어 주세요.",
    };
  }
  if (outcome.status === "failed") {
    if (cached) {
      return { status: "ok", results: cached.results as SearchResult[], cached: true };
    }
    return {
      status: "unavailable",
      message: "검색에 실패했어요. 잠시 후 다시 시도하거나 링크를 붙여넣어 주세요.",
    };
  }

  // 캐시 저장 실패가 검색 결과를 막지는 않는다.
  await admin
    .from("youtube_search_cache")
    .upsert(
      { query: normalized, results: outcome.results, created_at: new Date().toISOString() },
      { onConflict: "query" },
    );

  return { status: "ok", results: outcome.results, cached: false };
}
