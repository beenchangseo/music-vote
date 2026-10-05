"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritable } from "@/lib/playlist-access";
import { ARCHIVED_PLAYLIST_MESSAGE, isArchivedPlaylist } from "@/lib/playlist-archive";
import { extractVideoId, fetchVideoMetadata } from "@/lib/youtube";
import { fetchSingleVideoDetails } from "@/lib/youtube-data";
import {
  isValidKeyRoot,
  isValidKeyMode,
  isValidGenre,
  isValidDifficulty,
} from "@/lib/song-meta";
import { nestedRows } from "@/lib/supabase/nested";
import type { KeyRoot, KeyMode, Genre, Difficulty } from "@/lib/types";
import { revalidatePath } from "next/cache";

type CarriedSongMeta = {
  key_memo: string | null;
  tempo_bpm: number | null;
  key_root: KeyRoot | null;
  key_mode: KeyMode | null;
};

const hasAnyMeta = (row: CarriedSongMeta) =>
  row.key_memo != null || row.tempo_bpm != null || row.key_root != null || row.key_mode != null;

/**
 * E4 키·BPM 이어받기. 방이 밴드에 속해 있으면 같은 밴드의 다른 방에서 같은 영상을 찾아,
 * 네 값(key_memo·tempo_bpm·key_root·key_mode) 가운데 하나라도 있는 가장 최근 행의 네 값을
 * 섞지 않고 그대로 돌려준다.
 *
 * 밴드 밖으로는 절대 찾지 않는다. key_memo("+3키" 같은)는 그 밴드에서만 통하는 상대 표기다.
 * songs 는 공개 키로 읽을 수 없으므로(v18) service_role 로 읽는다.
 * 조회가 실패해도 곡 추가를 막지 않는다: null + console.error.
 */
async function findTeamSongMeta(playlistId: string, videoId: string): Promise<CarriedSongMeta | null> {
  try {
    const admin = createAdminClient();
    const { data: room, error: roomError } = await admin
      .from("playlists")
      .select("team_id")
      .eq("id", playlistId)
      .maybeSingle();
    if (roomError) {
      console.error("[song.addSong] team lookup failed", { playlistId, code: roomError.code });
      return null;
    }
    const teamId: string | null = room?.team_id ?? null;
    if (!teamId) return null;

    const { data, error } = await admin
      .from("songs")
      .select("key_memo, tempo_bpm, key_root, key_mode, created_at, playlists!inner(team_id)")
      .eq("youtube_video_id", videoId)
      .eq("playlists.team_id", teamId)
      .neq("playlist_id", playlistId)
      .or("key_memo.not.is.null,tempo_bpm.not.is.null,key_root.not.is.null,key_mode.not.is.null")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      console.error("[song.addSong] team song meta lookup failed", { playlistId, teamId, code: error.code });
      return null;
    }

    type Row = CarriedSongMeta & {
      playlists: { team_id: string | null } | { team_id: string | null }[] | null;
    };
    // The query already filters by band and non-null meta; check again so a
    // wrong filter can never leak another band's key memo.
    const match = ((data ?? []) as Row[]).find(
      (row) => nestedRows(row.playlists)[0]?.team_id === teamId && hasAnyMeta(row),
    );
    if (!match) return null;
    return {
      key_memo: match.key_memo,
      tempo_bpm: match.tempo_bpm,
      key_root: match.key_root,
      key_mode: match.key_mode,
    };
  } catch (error) {
    console.error("[song.addSong] team song meta lookup threw", {
      playlistId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function addSong(
  playlistId: string,
  youtubeUrl: string,
  shareCode: string,
  manualTitle?: string
) {
  if (!youtubeUrl || youtubeUrl.length > 500) {
    throw new Error("올바른 YouTube URL을 입력해주세요.");
  }

  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("올바른 YouTube URL을 입력해주세요.");
  }

  // 제목·썸네일은 oEmbed, 재생시간·임베드 가능 여부는 Data API 가 준다.
  // 둘 다 실패해도 곡 추가는 진행한다. 밴드 방이면 키·BPM 이어받기(E4)도 같이 찾는다.
  const [metadata, details, carriedMeta] = await Promise.all([
    manualTitle ? Promise.resolve(null) : fetchVideoMetadata(videoId),
    fetchSingleVideoDetails(videoId),
    findTeamSongMeta(playlistId, videoId),
  ]);

  const title = metadata?.title || manualTitle || youtubeUrl;
  const artist = metadata?.author_name || null;
  const thumbnailUrl = metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  await assertPlaylistWritable(playlistId);

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("songs").insert({
    playlist_id: playlistId,
    title,
    artist,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    thumbnail_url: thumbnailUrl,
    duration_seconds: details?.durationSeconds ?? null,
    added_by: user.nickname,
    added_by_user_id: user.id,
    ...(carriedMeta ?? {}),
  });

  if (error) throw new Error("곡 추가에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return {
    success: true,
    needsManualTitle: !metadata && !manualTitle,
    // 임베드가 막힌 곡은 합주 중에 재생되지 않는다. 화면에서 알려준다.
    notEmbeddable: details ? !details.embeddable : false,
    // 같은 밴드에서 적어둔 키·BPM 을 가져왔다 (화면: "지난번에 적어둔 키·BPM 을 가져왔어요").
    prefilledMeta: carriedMeta !== null,
  };
}

export interface SongMetaUpdate {
  keyMemo?: string | null;
  tempoBpm?: number | null;
  durationSeconds?: number | null;
  keyRoot?: KeyRoot | null;
  keyMode?: KeyMode | null;
  difficulty?: Difficulty | null;
  genre?: Genre | null;
}

export async function updateSongMeta(
  songId: string,
  playlistId: string,
  shareCode: string,
  data: SongMetaUpdate,
) {
  await assertPlaylistWritable(playlistId);

  /*
    v15 가 `songs_update USING(true)` 를 지우면서 공개 키로는 곡을 못 고치게 됐다.
    그런데 이 액션은 anon 클라이언트를 그대로 쓰고 있었고, RLS 가 막은 UPDATE 는
    에러 없이 0행을 돌려주기 때문에 키·BPM·길이 저장이 조용히 실패하고 있었다.
    권한을 코드에서 확인하고 service_role 로 쓴다 (AGENTS.md 데이터 흐름 규칙).
    쓰기 자격은 곡 등록과 같게 둔다 — 로그인한 사람이면 합주 메타를 채울 수 있다.
  */
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const admin = createAdminClient();

  // Verify song belongs to playlist
  const { data: song } = await admin
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("playlist_id", playlistId)
    .single();

  if (!song) throw new Error("곡을 찾을 수 없습니다.");

  const updateData: Record<string, unknown> = {};

  if (data.keyMemo !== undefined) {
    updateData.key_memo = data.keyMemo;
  }
  if (data.tempoBpm !== undefined) {
    const bpm = data.tempoBpm;
    updateData.tempo_bpm =
      bpm == null ? null : bpm >= 40 && bpm <= 300 ? bpm : null;
  }
  if (data.durationSeconds !== undefined) {
    updateData.duration_seconds = data.durationSeconds;
  }
  if (data.keyRoot !== undefined) {
    updateData.key_root =
      data.keyRoot == null ? null : isValidKeyRoot(data.keyRoot) ? data.keyRoot : null;
  }
  if (data.keyMode !== undefined) {
    updateData.key_mode =
      data.keyMode == null ? null : isValidKeyMode(data.keyMode) ? data.keyMode : null;
  }
  if (data.difficulty !== undefined) {
    updateData.difficulty =
      data.difficulty == null ? null : isValidDifficulty(data.difficulty) ? data.difficulty : null;
  }
  if (data.genre !== undefined) {
    updateData.genre =
      data.genre == null ? null : isValidGenre(data.genre) ? data.genre : null;
  }

  if (Object.keys(updateData).length === 0) return { success: true };

  const { data: updated, error } = await admin
    .from("songs")
    .update(updateData)
    .eq("id", songId)
    .select("id");

  if (error) throw new Error("곡 정보 업데이트에 실패했습니다.");
  // 0행이면 조용히 성공한 척하지 않는다. v15 회귀가 여기서 묻혔다.
  if (!updated || updated.length === 0) throw new Error("곡 정보 업데이트에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function removeSong(
  songId: string,
  playlistId: string,
  shareCode: string
) {
  const admin = createAdminClient();
  const { data: song } = await admin
    .from("songs")
    .select("id, added_by_user_id, playlists!inner(creator_user_id)")
    .eq("id", songId)
    .eq("playlist_id", playlistId)
    .single<{
      id: string;
      added_by_user_id: string | null;
      playlists: { creator_user_id: string | null };
    }>();

  if (!song) throw new Error("곡을 찾을 수 없습니다.");
  if (isArchivedPlaylist(song.playlists)) throw new Error(ARCHIVED_PLAYLIST_MESSAGE);

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const isHost = user.id === song.playlists.creator_user_id;
  const isAdder = user.id === song.added_by_user_id;
  if (!isHost && !isAdder) throw new Error("이 곡을 삭제할 권한이 없습니다.");

  const { error } = await admin
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("playlist_id", playlistId);
  if (error) throw new Error("곡 삭제에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
