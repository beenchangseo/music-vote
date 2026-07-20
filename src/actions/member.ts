"use server";

import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistAdmin } from "@/lib/playlist-admin";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { PlaylistMember, VoteAllowance, VotingMode } from "@/lib/types";
import { revalidatePath } from "next/cache";

function actionError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export async function registerPlaylistMember(
  playlistId: string,
): Promise<VoteAllowance | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("register_playlist_member", {
    p_playlist_id: playlistId,
  });
  if (error) actionError(error, "참여자 등록에 실패했습니다.");

  return getMyVoteAllowance(playlistId);
}

export async function getMyVoteAllowance(
  playlistId: string,
): Promise<VoteAllowance | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createAdminClient();

  const [{ data: playlist }, { data: member }, { count }] = await Promise.all([
    admin
      .from("playlists")
      .select("voting_mode, default_vote_limit")
      .eq("id", playlistId)
      .single(),
    admin
      .from("playlist_members")
      .select("vote_limit")
      .eq("playlist_id", playlistId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("votes")
      .select("id, songs!inner(playlist_id)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("songs.playlist_id", playlistId),
  ]);

  if (!playlist) return null;
  return {
    mode: playlist.voting_mode as VotingMode,
    voteLimit: member?.vote_limit ?? playlist.default_vote_limit,
    usedVotes: count ?? 0,
  };
}

export interface VotingSettings {
  mode: VotingMode;
  votesAnonymous: boolean;
  defaultVoteLimit: number;
  totalVotes: number;
  members: PlaylistMember[];
}

export interface MemberVoteLimitInput {
  userId: string;
  voteLimit: number;
}

export async function getVotingSettings(
  playlistId: string,
  adminToken: string | null,
): Promise<VotingSettings> {
  await assertPlaylistAdmin(playlistId, adminToken);
  const admin = createAdminClient();

  const [{ data: playlist }, { data: members }, { data: votes }] = await Promise.all([
    admin
      .from("playlists")
      .select("voting_mode, votes_anonymous, default_vote_limit")
      .eq("id", playlistId)
      .single(),
    admin
      .from("playlist_members")
      .select("playlist_id, user_id, display_name, vote_limit, joined_at")
      .eq("playlist_id", playlistId)
      .order("joined_at", { ascending: true }),
    admin
      .from("votes")
      .select("user_id, songs!inner(playlist_id)")
      .eq("songs.playlist_id", playlistId),
  ]);

  if (!playlist) throw new Error("합주방을 찾을 수 없습니다.");
  const usedByUser = new Map<string, number>();
  for (const vote of votes || []) {
    if (!vote.user_id) continue;
    usedByUser.set(vote.user_id, (usedByUser.get(vote.user_id) || 0) + 1);
  }

  return {
    mode: playlist.voting_mode as VotingMode,
    votesAnonymous: playlist.votes_anonymous,
    defaultVoteLimit: playlist.default_vote_limit,
    totalVotes: (votes || []).length,
    members: (members || []).map((member) => ({
      ...member,
      used_votes: usedByUser.get(member.user_id) || 0,
    })) as PlaylistMember[],
  };
}

export async function saveVotingSettings(
  playlistId: string,
  adminToken: string | null,
  votesAnonymous: boolean,
  mode: VotingMode,
  defaultVoteLimit: number,
  memberLimits: MemberVoteLimitInput[],
  shareCode: string,
) {
  await assertPlaylistAdmin(playlistId, adminToken);

  if (typeof votesAnonymous !== "boolean") {
    throw new Error("투표 공개 범위가 올바르지 않습니다.");
  }
  if (mode !== "free" && mode !== "allocated") {
    throw new Error("잘못된 투표 방식입니다.");
  }
  if (!Number.isInteger(defaultVoteLimit) || defaultVoteLimit < 1 || defaultVoteLimit > 99) {
    throw new Error("기본 투표권은 1~99개여야 합니다.");
  }
  if (memberLimits.some(({ voteLimit }) => !Number.isInteger(voteLimit) || voteLimit < 0 || voteLimit > 99)) {
    throw new Error("참여자별 투표권은 0~99개 정수여야 합니다.");
  }

  const admin = createAdminClient();
  const { data: playlist, error: playlistError } = await admin
    .from("playlists")
    .select("creator_user_id")
    .eq("id", playlistId)
    .single();

  if (playlistError || !playlist) throw new Error("합주방을 찾을 수 없습니다.");
  if (!playlist.creator_user_id && mode === "allocated") {
    throw new Error("기존 합주방에서는 자유 투표만 사용할 수 있습니다.");
  }

  const { error } = await admin.rpc("save_playlist_voting_settings", {
    p_playlist_id: playlistId,
    p_votes_anonymous: votesAnonymous,
    p_mode: mode,
    p_default_limit: defaultVoteLimit,
    p_member_limits: memberLimits.map(({ userId, voteLimit }) => ({
      user_id: userId,
      vote_limit: voteLimit,
    })),
  });

  if (error) actionError(error, "투표 설정 변경에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function configureVoting(
  playlistId: string,
  mode: VotingMode,
  defaultVoteLimit: number,
  shareCode: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("configure_playlist_voting", {
    p_playlist_id: playlistId,
    p_mode: mode,
    p_default_limit: defaultVoteLimit,
  });
  if (error) actionError(error, "투표 설정 변경에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function updateMemberVoteLimit(
  playlistId: string,
  userId: string,
  voteLimit: number,
  shareCode: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_member_vote_limit", {
    p_playlist_id: playlistId,
    p_user_id: userId,
    p_vote_limit: voteLimit,
  });
  if (error) actionError(error, "투표권 변경에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}

export async function applyVoteLimitToAll(
  playlistId: string,
  voteLimit: number,
  shareCode: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("apply_vote_limit_to_all", {
    p_playlist_id: playlistId,
    p_vote_limit: voteLimit,
  });
  if (error) actionError(error, "일괄 변경에 실패했습니다.");
  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
