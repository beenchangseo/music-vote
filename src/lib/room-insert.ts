// 서버 전용. service_role 클라이언트를 쓰므로 화면에서 import 하지 않는다.
//
// 합주방 한 개를 만드는 쓰기 단계(방 → 방장 토큰 → 첫 참여자)를 한 곳에 둔다.
// createPlaylist(throw 계약)와 createBandPlaylist(반환값 계약)가 함께 쓴다.
// "use server" 파일에 두면 export 하는 순간 누구나 부를 수 있는 서버 액션이 되므로
// 권한 검사를 마친 액션만 부르는 일반 모듈로 둔다. 입력 검증과 권한 검사는 호출부의 몫이다.
import { nanoid } from "nanoid";
import { createAdminClient } from "@/lib/supabase/server";
import type { TeamLinkedVia, VotingMode } from "@/lib/types";

export interface RoomInsertInput {
  title: string;
  deadline?: string;
  setlistCount?: number;
  votingMode: VotingMode;
  defaultVoteLimit: number;
  /** Always the session user. Never a value supplied by the caller's client. */
  creator: { id: string; nickname: string };
  /** Set only by createBandPlaylist after its membership check. */
  team?: { id: string; linkedVia: TeamLinkedVia };
}

export type RoomInsertResult =
  | { ok: true; id: string; shareCode: string; adminToken: string }
  | { ok: false; reason: "insert_failed" | "share_code_exhausted" };

export async function insertRoom(input: RoomInsertInput): Promise<RoomInsertResult> {
  const admin = createAdminClient();

  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const shareCode = nanoid(8);
    const adminToken = nanoid(16);

    // The public insert policy is gone (v18). creator_user_id comes from the
    // session user, never from the caller.
    const { data, error } = await admin
      .from("playlists")
      .insert({
        title: input.title,
        share_code: shareCode,
        deadline: input.deadline || null,
        setlist_count: input.setlistCount && input.setlistCount > 0 ? input.setlistCount : null,
        creator_nickname: input.creator.nickname,
        creator_user_id: input.creator.id,
        voting_mode: input.votingMode,
        default_vote_limit: input.defaultVoteLimit,
        ...(input.team ? { team_id: input.team.id, team_linked_via: input.team.linkedVia } : {}),
      })
      .select("id, share_code")
      .single();

    if (error?.code === "23505") continue; // unique violation, retry
    if (error) return { ok: false, reason: "insert_failed" };

    // Store admin token in separate table (service role only)
    const { error: adminError } = await admin.from("playlist_admin").insert({
      playlist_id: data.id,
      admin_token: adminToken,
    });

    if (adminError) {
      // Rollback: delete the playlist since admin token failed
      await admin.from("playlists").delete().eq("id", data.id);
      return { ok: false, reason: "insert_failed" };
    }

    const { error: memberError } = await admin.from("playlist_members").insert({
      playlist_id: data.id,
      user_id: input.creator.id,
      display_name: input.creator.nickname,
      vote_limit: input.defaultVoteLimit,
    });

    if (memberError) {
      await admin.from("playlists").delete().eq("id", data.id);
      return { ok: false, reason: "insert_failed" };
    }

    return { ok: true, id: data.id, shareCode: data.share_code, adminToken };
  }

  return { ok: false, reason: "share_code_exhausted" };
}
