"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritableBySong } from "@/lib/playlist-access";
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

/**
 * 투표는 DB 함수 하나로 처리한다.
 * 투표권 검사와 동시 요청 직렬화를 한 트랜잭션 안에서 끝내기 위해서다.
 * 닉네임은 카카오 프로필에서 가져오므로 화면이 보내지 않는다.
 */
export async function castVote(
  songId: string,
  voteType: number,
  shareCode: string
): Promise<CastVoteResult> {
  if (voteType !== 1 && voteType !== -1) {
    throw new Error("잘못된 투표 값입니다.");
  }

  await assertPlaylistWritableBySong(songId);

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = await createServerSupabaseClient();
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
