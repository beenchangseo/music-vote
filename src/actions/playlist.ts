"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import { insertRoom } from "@/lib/room-insert";
import { nestedRows } from "@/lib/supabase/nested";
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
  createdAt: string;
  /** 내가 멤버인 밴드의 방이면 그 밴드 이름 (홈 목록의 작은 캡션). 아니면 null. */
  teamName: string | null;
}

type MyPlaylistRow = { id: string; share_code: string; title: string; created_at: string };
type MyTeamRow = { name: string; playlists: MyPlaylistRow | MyPlaylistRow[] | null };

const MY_PLAYLIST_COLUMNS = "id, share_code, title, created_at";

/**
 * 홈 "내 합주방": 내가 만든 방 ∪ 참여자로 들어간 방 ∪ 내 밴드의 방.
 * id 로 중복을 없애고 created_at 내림차순. 비로그인 시 빈 배열.
 *
 * 세 집합은 FK 중첩 select 로 한 번의 Promise.all 에 읽는다 (eng D5, 왕복 1번).
 * 한 집합의 조회가 실패해도 나머지 집합은 보여준다 (+ console.error).
 */
export async function getMyPlaylists(): Promise<MyPlaylistDbEntry[]> {
  // The user comes from the session; playlists itself is read with service_role
  // because the public key can no longer select it (v18).
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createAdminClient();
  const [created, joined, teams] = await Promise.all([
    admin.from("playlists").select(MY_PLAYLIST_COLUMNS).eq("creator_user_id", user.id),
    admin.from("playlist_members").select(`playlists(${MY_PLAYLIST_COLUMNS})`).eq("user_id", user.id),
    admin.from("team_members").select(`teams(name, playlists(${MY_PLAYLIST_COLUMNS}))`).eq("user_id", user.id),
  ]);

  const sets = { created, joined, teams };
  for (const [set, result] of Object.entries(sets)) {
    if (result.error) {
      console.error(`[playlist.getMyPlaylists] ${set} rooms lookup failed`, {
        userId: user.id,
        code: result.error.code,
      });
    }
  }

  const byId = new Map<string, MyPlaylistDbEntry>();
  const add = (room: MyPlaylistRow, teamName: string | null) => {
    const existing = byId.get(room.id);
    if (existing) {
      if (teamName) existing.teamName = teamName;
      return;
    }
    byId.set(room.id, {
      id: room.id,
      shareCode: room.share_code,
      title: room.title,
      createdAt: room.created_at,
      teamName,
    });
  };

  if (!created.error) {
    for (const room of (created.data ?? []) as MyPlaylistRow[]) add(room, null);
  }
  if (!joined.error) {
    for (const row of (joined.data ?? []) as { playlists: MyPlaylistRow | MyPlaylistRow[] | null }[]) {
      for (const room of nestedRows(row.playlists)) add(room, null);
    }
  }
  if (!teams.error) {
    for (const row of (teams.data ?? []) as { teams: MyTeamRow | MyTeamRow[] | null }[]) {
      for (const team of nestedRows(row.teams)) {
        for (const room of nestedRows(team.playlists)) add(room, team.name);
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  // The insert steps (room → admin token → creator as first member, with
  // rollback) live in insertRoom so createBandPlaylist uses the same code.
  const result = await insertRoom({
    title,
    deadline,
    setlistCount,
    votingMode,
    defaultVoteLimit,
    creator: { id: user.id, nickname: user.nickname },
  });
  if (!result.ok) {
    if (result.reason === "share_code_exhausted") {
      throw new Error("share_code 생성에 실패했습니다. 다시 시도해주세요.");
    }
    throw new Error("플레이리스트 생성에 실패했습니다.");
  }

  return { id: result.id, shareCode: result.shareCode, adminToken: result.adminToken };
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
