"use server";

import { nanoid } from "nanoid";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import type { SetlistEditMode, VotingMode } from "@/lib/types";
import { revalidatePath } from "next/cache";

/**
 * 홈 페이지 하단 통계용 카운트.
 * Cache 는 호출부에서 react cache() or revalidate 로.
 */
export async function getHomeStats(): Promise<{
  playlists: number;
  users: number;
  songs: number;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("home_stats")
    .select("playlist_count, song_count, participant_count")
    .single();
  return {
    playlists: data?.playlist_count ?? 0,
    users: data?.participant_count ?? 0,
    songs: data?.song_count ?? 0,
  };
}

export interface MyPlaylistDbEntry {
  id: string;
  shareCode: string;
  title: string;
}

/**
 * 로그인 사용자의 플리 목록 (creator_user_id = auth.uid()).
 * 비로그인 시 빈 배열.
 */
export async function getMyPlaylists(): Promise<MyPlaylistDbEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, share_code, title, created_at")
    .eq("creator_user_id", user.id)
    .order("created_at", { ascending: false });
  return (data || []).map((p) => ({
    id: p.id,
    shareCode: p.share_code,
    title: p.title,
  }));
}

export async function createPlaylist(
  title: string,
  deadline?: string,
  setlistCount?: number,
  votingMode: VotingMode = "free",
  defaultVoteLimit = 3,
) {
  if (!title || title.length > 100) {
    throw new Error("플레이리스트 제목은 1~100자여야 합니다.");
  }

  const supabase = await createServerSupabaseClient();
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  if (votingMode !== "free" && votingMode !== "allocated") {
    throw new Error("올바른 투표 방식을 선택해주세요.");
  }
  if (!Number.isInteger(defaultVoteLimit) || defaultVoteLimit < 1 || defaultVoteLimit > 99) {
    throw new Error("기본 투표권은 1~99개여야 합니다.");
  }
  const admin = createAdminClient();

  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const shareCode = nanoid(8);
    const adminToken = nanoid(16);

    const { data, error } = await supabase
      .from("playlists")
      .insert({
        title,
        share_code: shareCode,
        deadline: deadline || null,
        setlist_count: setlistCount && setlistCount > 0 ? setlistCount : null,
        creator_nickname: user.nickname,
        creator_user_id: user.id,
        voting_mode: votingMode,
        default_vote_limit: defaultVoteLimit,
      })
      .select("id, share_code")
      .single();

    if (error?.code === "23505") continue; // unique violation, retry
    if (error) throw new Error("플레이리스트 생성에 실패했습니다.");

    // Store admin token in separate table (service role only)
    const { error: adminError } = await admin.from("playlist_admin").insert({
      playlist_id: data.id,
      admin_token: adminToken,
    });

    if (adminError) {
      // Rollback: delete the playlist since admin token failed
      await admin.from("playlists").delete().eq("id", data.id);
      throw new Error("플레이리스트 생성에 실패했습니다.");
    }

    const { error: memberError } = await admin.from("playlist_members").insert({
      playlist_id: data.id,
      user_id: user.id,
      display_name: user.nickname,
      vote_limit: defaultVoteLimit,
    });

    if (memberError) {
      await admin.from("playlists").delete().eq("id", data.id);
      throw new Error("플레이리스트 생성에 실패했습니다.");
    }

    return { id: data.id, shareCode: data.share_code, adminToken };
  }

  throw new Error("share_code 생성에 실패했습니다. 다시 시도해주세요.");
}

export async function updateCreatorNickname(
  playlistId: string,
  creatorNickname: string,
  shareCode: string,
  adminToken: string | null = null,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ creator_nickname: creatorNickname })
    .eq("id", playlistId);
  if (error) throw new Error("닉네임 저장에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateAnnouncementPublic(
  playlistId: string,
  announcement: string,
  shareCode: string,
  adminToken: string | null = null,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();

  const { error } = await admin
    .from("playlists")
    .update({ announcement: announcement || null })
    .eq("id", playlistId);

  if (error) throw new Error("공지사항 저장에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateAnnouncement(
  playlistId: string,
  adminToken: string | null,
  announcement: string,
  shareCode: string
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ announcement: announcement || null })
    .eq("id", playlistId);

  if (error) throw new Error("공지사항 저장에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateVotingMode(
  playlistId: string,
  adminToken: string | null,
  votesAnonymous: boolean,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ votes_anonymous: votesAnonymous })
    .eq("id", playlistId);

  if (error) throw new Error("투표 모드 변경에 실패했습니다.");

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function resetPlaylistVotes(
  playlistId: string,
  adminToken: string | null,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();
  const { data: songs, error: songsError } = await admin
    .from("songs")
    .select("id")
    .eq("playlist_id", playlistId);

  if (songsError) throw new Error("투표 초기화에 실패했습니다.");
  const songIds = (songs || []).map((song) => song.id);
  if (songIds.length === 0) return { success: true, deletedCount: 0 };

  const { count, error } = await admin
    .from("votes")
    .delete({ count: "exact" })
    .in("song_id", songIds);

  if (error) throw new Error("투표 초기화에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, deletedCount: count ?? 0 };
}

export async function updateSetlistEditMode(
  playlistId: string,
  adminToken: string | null,
  mode: SetlistEditMode,
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);
  if (mode !== "everyone" && mode !== "host_only") {
    throw new Error("잘못된 셋리스트 권한입니다.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .update({ setlist_edit_mode: mode })
    .eq("id", playlistId);
  if (error) throw new Error("셋리스트 권한 변경에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, mode };
}

export async function deletePlaylist(playlistId: string, adminToken: string | null) {
  // 보관된 합주방도 방장이 직접 정리할 수 있어야 한다.
  await assertPlaylistAdmin(playlistId, adminToken, { allowArchived: true });
  const admin = createAdminClient();
  const { error } = await admin
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) throw new Error("플레이리스트 삭제에 실패했습니다.");

  revalidatePath("/");
  return { success: true };
}
