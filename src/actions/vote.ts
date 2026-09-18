"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylistModeBySong } from "@/lib/playlist-mode";
import { revalidatePath } from "next/cache";

export type CastVoteResult =
  | {
      success: true;
      allowance: { usedVotes: number; voteLimit: number } | null;
    }
  | {
      success: false;
      reason: "vote_limit_reached";
    };

export async function castVote(
  songId: string,
  nickname: string,
  voteType: number,
  shareCode: string
): Promise<CastVoteResult> {
  if (voteType !== 1 && voteType !== -1) {
    throw new Error("잘못된 투표 값입니다.");
  }

  const supabase = await createServerSupabaseClient();
  const { requiresLogin } = await getPlaylistModeBySong(songId);

  // Login mode: user_id 기반. nickname 은 카카오 닉으로 자동.
  if (requiresLogin) {
    const user = await getCurrentUser();
    if (!user) throw new Error("로그인이 필요합니다.");
    const { data, error } = await supabase.rpc("cast_playlist_vote", {
      p_song_id: songId,
      p_vote_type: voteType,
      p_nickname: user.nickname,
    });
    if (error?.code === "P0001" && error.message.includes("투표권을 모두 사용했습니다")) {
      return { success: false, reason: "vote_limit_reached" };
    }
    if (error) throw new Error(error.message || "투표에 실패했습니다.");

    revalidatePath(`/playlist/${shareCode}`);
    const row = data?.[0];
    return {
      success: true,
      allowance: row
        ? { usedVotes: row.used_votes, voteLimit: row.vote_limit }
        : null,
    };
  }

  // Anonymous mode (legacy): nickname 기반.
  const trimmedNickname = nickname?.trim();
  if (!trimmedNickname || trimmedNickname.length > 20) {
    throw new Error("닉네임이 올바르지 않습니다.");
  }

  const { data: existing } = await supabase
    .from("votes")
    .select("id, vote_type")
    .eq("song_id", songId)
    .eq("nickname", trimmedNickname)
    .single();

  if (existing) {
    if (existing.vote_type === voteType) {
      const { error } = await supabase.from("votes").delete().eq("id", existing.id);
      if (error) throw new Error("투표 취소에 실패했습니다.");
    } else {
      const { error } = await supabase
        .from("votes")
        .update({ vote_type: voteType })
        .eq("id", existing.id);
      if (error) throw new Error("투표 변경에 실패했습니다.");
    }
  } else {
    const { error } = await supabase.from("votes").insert({
      song_id: songId,
      nickname: trimmedNickname,
      vote_type: voteType,
    });
    if (error) throw new Error("투표에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true, allowance: null };
}
