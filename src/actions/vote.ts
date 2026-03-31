"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function castVote(
  songId: string,
  nickname: string,
  voteType: number,
  shareCode: string
) {
  if (voteType !== 1 && voteType !== -1) {
    throw new Error("잘못된 투표 값입니다.");
  }
  const trimmedNickname = nickname?.trim();
  if (!trimmedNickname || trimmedNickname.length > 20) {
    throw new Error("닉네임이 올바르지 않습니다.");
  }

  const supabase = await createServerSupabaseClient();

  // Check existing vote
  const { data: existing } = await supabase
    .from("votes")
    .select("id, vote_type")
    .eq("song_id", songId)
    .eq("nickname", trimmedNickname)
    .single();

  if (existing) {
    if (existing.vote_type === voteType) {
      // Same direction: toggle off (remove vote)
      const { error } = await supabase.from("votes").delete().eq("id", existing.id);
      if (error) throw new Error("투표 취소에 실패했습니다.");
    } else {
      // Different direction: change vote
      const { error } = await supabase
        .from("votes")
        .update({ vote_type: voteType })
        .eq("id", existing.id);
      if (error) throw new Error("투표 변경에 실패했습니다.");
    }
  } else {
    // New vote
    const { error } = await supabase.from("votes").insert({
      song_id: songId,
      nickname: trimmedNickname,
      vote_type: voteType,
    });
    if (error) throw new Error("투표에 실패했습니다.");
  }

  revalidatePath(`/playlist/${shareCode}`);
  return { success: true };
}
