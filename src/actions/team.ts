"use server";

/*
  밴드(팀) 서버 액션. 코드·DB 는 team, 화면은 "밴드" (ADR 0014).

  - teams·team_members 는 공개 키로 접근할 수 없다(v19 REVOKE ALL). 모든 읽기·쓰기는
    service_role(createAdminClient)로 하고, 누가 owner·member·방장인지는 여기서 검사한다.
  - 예상된 실패는 throw 하지 않고 { success: false, reason } 으로 돌려준다(castVote 와 같은 모양).
    reason → 문구는 src/lib/team-messages.ts.
  - RLS 와 무관하게 조건에 맞는 행이 없으면 UPDATE/DELETE 는 에러 없이 0행이다.
    쓰기 뒤에는 늘 .select() 로 행 수를 확인한다.
  - console.error 에는 액션 이름과 id 만 남긴다. 닉네임은 남기지 않는다.

  액션별 권한 (계획 "HOLD SCOPE 점검" 표):
    createTeam              로그인 (홈의 빈 밴드, 누른 사람이 owner 혼자)
    createTeamFromPlaylist  로그인 · 방장 · assertPlaylistWritable
    attachPlaylistToTeam    로그인 · 방장 그리고 그 밴드 멤버 · assertPlaylistWritable
    joinTeam                로그인 · 유효한 초대 코드
    createBandPlaylist      로그인 · 그 밴드 멤버 (새 방)
    updateTeamNextShow      로그인 · 그 밴드 멤버
    removeTeamMember        로그인 · 그 밴드 owner, 자기 자신 제외
    regenerateInviteCode    로그인 · 그 밴드 owner
    leaveTeam               로그인 · owner 가 아닌 멤버 (자기 행만)
    getTeamInvite           불필요 · 이름·멤버 수·앞 3명·공연 날짜만 (방·초대 코드 없음)
    getTeamHome             불필요 · 멤버만 본문, 그 외에는 밴드 이름만
    getMyTeams              불필요 (비로그인 빈 배열) · 내 team_members 행만
*/

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertPlaylistWritable } from "@/lib/playlist-access";
import { ARCHIVED_PLAYLIST_MESSAGE } from "@/lib/playlist-archive";
import { insertRoom } from "@/lib/room-insert";
import { createAdminClient } from "@/lib/supabase/server";
import { nestedRows } from "@/lib/supabase/nested";
import {
  canPromote,
  isInviteCodeFormat,
  isTeamIdFormat,
  previewMemberNames,
  roomCoverThumbs,
  sortMembersForDisplay,
  validateNextShowDate,
  validateTeamName,
} from "@/lib/team-domain";
import type { TeamReason } from "@/lib/team-messages";
import type { ActionResult, TeamRole, VotingMode } from "@/lib/types";

// ============================================================
// 반환 타입
// ============================================================

export type CreateTeamFromPlaylistResult = ActionResult<
  /** `name`·`inviteCode` feed the room's success card and invite sheet (D30A); only the owner gets them. */
  { teamId: string; name: string; inviteCode: string; memberCount: number },
  | "not_logged_in"
  | "invalid_name"
  | "playlist_not_found"
  | "archived"
  | "not_room_owner"
  | "already_in_team"
  | "invite_code_conflict"
  | "write_failed"
>;

export type CreateTeamResult = ActionResult<
  { teamId: string },
  "not_logged_in" | "invalid_name" | "invite_code_conflict" | "write_failed"
>;

export type JoinTeamResult = ActionResult<
  { teamId: string; alreadyMember: boolean },
  "not_logged_in" | "invite_not_found" | "write_failed"
>;

export type CreateBandPlaylistResult = ActionResult<
  { id: string; shareCode: string; adminToken: string },
  | "not_logged_in"
  | "invalid_title"
  | "invalid_voting_mode"
  | "invalid_vote_limit"
  | "team_not_found"
  | "not_member"
  | "write_failed"
>;

export type UpdateTeamNextShowResult = ActionResult<
  { nextShowAt: string | null },
  "not_logged_in" | "invalid_date" | "past_date" | "team_not_found" | "not_member" | "write_failed"
>;

export type RegenerateInviteCodeResult = ActionResult<
  { inviteCode: string },
  "not_logged_in" | "team_not_found" | "not_team_owner" | "invite_code_conflict" | "write_failed"
>;

export type RemoveTeamMemberReason =
  | "not_logged_in"
  | "team_not_found"
  | "cannot_remove_self"
  | "not_team_owner"
  | "member_not_found"
  | "invite_code_conflict"
  | "invite_rotated_remove_failed"
  | "write_failed";

export type RemoveTeamMemberResult =
  /** `inviteCode` is the new code when the link was rotated, otherwise null. */
  | { success: true; inviteCode: string | null }
  /**
   * `inviteCode` is present only when the link was already rotated before the
   * removal failed. The old link is dead either way; show the new one.
   */
  | { success: false; reason: RemoveTeamMemberReason; inviteCode?: string };

export type LeaveTeamResult = ActionResult<
  Record<never, never>,
  "not_logged_in" | "team_not_found" | "not_member" | "owner_cannot_leave" | "write_failed"
>;

export type AttachPlaylistToTeamResult = ActionResult<
  { teamId: string },
  | "not_logged_in"
  | "team_not_found"
  | "playlist_not_found"
  | "archived"
  | "not_room_owner"
  | "already_in_team"
  | "not_member"
  | "write_failed"
>;

/** 초대 화면(/join/[inviteCode]) 데이터. 방 목록과 초대 코드는 싣지 않는다. */
export type TeamInviteView =
  /** 이미 멤버. 화면은 /band/{teamId} 로 보낸다. */
  | { status: "member"; teamId: string; name: string }
  | {
      status: "invite";
      loggedIn: boolean;
      name: string;
      memberCount: number;
      /** 앞 3명, owner 먼저 그다음 가입 순 (디자인 2A). */
      previewNames: string[];
      nextShowAt: string | null;
    };

export interface TeamHomeMember {
  /** owner 화면에서만 채운다 (내보내기 대상 지정용). 그 외에는 null. */
  userId: string | null;
  displayName: string;
  role: TeamRole;
  joinedAt: string;
  isMe: boolean;
}

export interface TeamSetlistSong {
  songId: string;
  title: string;
  artist: string | null;
  position: number;
  /** 같은 곡을 여러 방에서 한 번으로 묶는 키 (방마다 song 행이 따로라 songId 로는 못 묶는다). */
  videoId: string | null;
  thumbnailUrl: string | null;
}

export interface TeamRoom {
  id: string;
  shareCode: string;
  title: string;
  createdAt: string;
  setlistConfirmed: boolean;
  /** E1 "우리가 했던 곡": 이 방 셋리스트의 곡만, position 순. 셋리스트가 없으면 빈 배열. */
  setlist: TeamSetlistSong[];
  /** 후보곡 수 (셋리스트가 아니라 방에 올라온 곡 전체). */
  songCount: number;
  /** 방 커버 모자이크용 썸네일 최대 4개. 셋리스트 순서 먼저, 없으면 최근에 올라온 곡. */
  coverThumbs: string[];
}

/** 밴드 홈(/band/[teamId]) 데이터. */
export type TeamHomeView =
  /** 비로그인·비멤버: 밴드 이름만 (방·멤버·날짜·초대 코드 없음). */
  | { access: "guest"; loggedIn: boolean; team: { id: string; name: string } }
  | {
      access: "member";
      myRole: TeamRole;
      team: {
        id: string;
        name: string;
        /** 멤버 초대 시트용. 방 화면 페이로드에는 싣지 않는다 (R10). */
        inviteCode: string;
        nextShowAt: string | null;
        createdAt: string;
      };
      /** owner 먼저, 그다음 가입 순. */
      members: TeamHomeMember[];
      /** created_at 내림차순. */
      rooms: TeamRoom[];
    };

export interface MyTeam {
  id: string;
  name: string;
  nextShowAt: string | null;
  role: TeamRole;
  roomCount: number;
}

// ============================================================
// 내부 헬퍼
// ============================================================

type DbError = { code?: string; message?: string } | null;

const INVITE_CODE_LENGTH = 10;
const INVITE_CODE_RETRIES = 3;

function fail<R extends TeamReason>(reason: R): { success: false; reason: R } {
  return { success: false, reason };
}

function logTeamError(
  action: string,
  message: string,
  ids: Record<string, string | undefined>,
  error?: DbError,
) {
  console.error(`[team.${action}] ${message}`, { ...ids, code: error?.code });
}

/**
 * 새 초대 코드(nanoid 10자)로 쓰기를 시도하고, 코드가 겹치면(23505) 새 코드로 다시 한다.
 * 밴드 만들기와 링크 새로 만들기가 쓴다 (eng D3). 방 주소 share_code 의 재시도는 insertRoom 에 따로 있다.
 */
async function withFreshInviteCode<T>(
  attempt: (code: string) => PromiseLike<{ data: T | null; error: DbError }>,
): Promise<
  | { ok: true; code: string; data: T | null }
  | { ok: false; reason: "invite_code_conflict" | "write_failed"; error?: DbError }
> {
  for (let i = 0; i < INVITE_CODE_RETRIES; i++) {
    const code = nanoid(INVITE_CODE_LENGTH);
    const { data, error } = await attempt(code);
    if (error?.code === "23505") continue;
    if (error) return { ok: false, reason: "write_failed", error };
    return { ok: true, code, data };
  }
  return { ok: false, reason: "invite_code_conflict" };
}

/** 기존 합주방에 쓰는 경로의 보관 방 검사. 아는 에러만 reason 으로 바꾸고 나머지는 다시 던진다. */
async function roomWriteBlock(playlistId: string): Promise<"archived" | "playlist_not_found" | null> {
  try {
    await assertPlaylistWritable(playlistId);
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_PLAYLIST_MESSAGE) return "archived";
    if (error instanceof Error && error.message === "플레이리스트를 찾을 수 없습니다.") {
      return "playlist_not_found";
    }
    throw error;
  }
}

type Admin = ReturnType<typeof createAdminClient>;

/** 내 멤버 역할. 멤버가 아니면 role 이 null, 조회 실패면 ok: false. */
async function readMyRole(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<{ ok: true; role: TeamRole | null } | { ok: false; error: DbError }> {
  const { data, error } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, role: (data?.role as TeamRole | undefined) ?? null };
}

/** 밴드 만들기 보상 삭제. team_members 는 CASCADE 로 함께 지워진다. */
async function rollbackTeam(admin: Admin, action: string, teamId: string) {
  const { error } = await admin.from("teams").delete().eq("id", teamId);
  if (error) {
    // The team stays orphaned (no room points at it). Find it by id and delete it by hand.
    logTeamError(action, "rollback delete failed, orphan team left", { teamId }, error);
  }
}

// ============================================================
// 밴드 만들기 (방에서 올리기)
// ============================================================

/**
 * 방 설정·안내 카드의 "이 멤버로 밴드 만들기". 이 방의 참여자 전원이 멤버가 되고 누른 방장이 owner.
 *
 * 순서가 곧 계약이다. 바꾸지 말 것:
 *   검증(로그인·이름·보관·방장·이미 팀) ─▶ 1. teams insert (초대 코드 23505 재시도)
 *     ─▶ 2. team_members insert (참여자 전원)
 *     ─▶ 3. playlists 조건부 UPDATE .is("team_id", null) — 0행이면 다른 탭이 먼저 묶은 것
 *   2·3 이 실패하거나 3 이 0행이면 1 의 teams 행을 지운다(멤버는 CASCADE). 두 번 눌러도 고아 팀이 남지 않는다.
 */
export async function createTeamFromPlaylist(
  playlistId: string,
  name: string,
): Promise<CreateTeamFromPlaylistResult> {
  const action = "createTeamFromPlaylist";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  const teamName = validateTeamName(name);
  if (!teamName) return fail("invalid_name");

  const admin = createAdminClient();
  const [blocked, { data: room, error: roomError }] = await Promise.all([
    roomWriteBlock(playlistId),
    admin
      .from("playlists")
      .select("id, share_code, creator_user_id, team_id")
      .eq("id", playlistId)
      .maybeSingle(),
  ]);
  if (blocked) return fail(blocked);
  if (roomError) {
    logTeamError(action, "room lookup failed", { playlistId, userId: user.id }, roomError);
    return fail("write_failed");
  }
  if (!room) return fail("playlist_not_found");
  const denied = canPromote(room, user.id);
  if (denied) return fail(denied);

  const { data: roomMembers, error: roomMembersError } = await admin
    .from("playlist_members")
    .select("user_id, display_name")
    .eq("playlist_id", playlistId)
    .order("joined_at", { ascending: true });
  if (roomMembersError) {
    logTeamError(action, "room members lookup failed", { playlistId, userId: user.id }, roomMembersError);
    return fail("write_failed");
  }

  // 1. teams
  const created = await withFreshInviteCode<{ id: string }>((code) =>
    admin
      .from("teams")
      .insert({ name: teamName, invite_code: code, created_by: user.id, created_via: "promote" })
      .select("id")
      .single(),
  );
  if (!created.ok || !created.data) {
    const reason = created.ok ? "write_failed" : created.reason;
    logTeamError(action, "team insert failed", { playlistId, userId: user.id }, created.ok ? null : created.error);
    return fail(reason);
  }
  const teamId = created.data.id;

  // 2. team_members: the caller is the owner, every other room participant a member.
  const memberRows = [
    { team_id: teamId, user_id: user.id, display_name: user.nickname, role: "owner" as const },
    ...(roomMembers ?? [])
      .filter((member: { user_id: string }) => member.user_id !== user.id)
      .map((member: { user_id: string; display_name: string }) => ({
        team_id: teamId,
        user_id: member.user_id,
        display_name: member.display_name,
        role: "member" as const,
      })),
  ];
  const { error: membersInsertError } = await admin.from("team_members").insert(memberRows);
  if (membersInsertError) {
    logTeamError(action, "team_members insert failed", { teamId, playlistId }, membersInsertError);
    await rollbackTeam(admin, action, teamId);
    return fail("write_failed");
  }

  // 3. Link the room only if it is still without a band.
  const { data: linked, error: linkError } = await admin
    .from("playlists")
    .update({ team_id: teamId, team_linked_via: "promote" })
    .eq("id", playlistId)
    .is("team_id", null)
    .select("id");
  if (linkError || !linked || linked.length === 0) {
    if (linkError) logTeamError(action, "room link failed", { teamId, playlistId }, linkError);
    await rollbackTeam(admin, action, teamId);
    return fail(linkError ? "write_failed" : "already_in_team");
  }

  revalidatePath(`/playlist/${room.share_code}`);
  return { success: true, teamId, name: teamName, inviteCode: created.code, memberCount: memberRows.length };
}

// ============================================================
// 빈 밴드 만들기 (홈, CEO2-A)
// ============================================================

/**
 * 홈의 "새 밴드" → "멤버 없이 새 밴드로 시작". 플레이리스트 없이 누른 사람 혼자인 밴드를 만든다.
 * 멤버는 초대 링크로만 들어온다.
 *
 *   검증(로그인·이름) ─▶ 1. teams insert (created_via 'home', 초대 코드 23505 재시도)
 *     ─▶ 2. team_members insert (owner 한 줄)
 *   2 가 실패하면 1 의 teams 행을 지운다. owner 없는 밴드는 아무도 볼 수 없는 고아다.
 */
export async function createTeam(name: string): Promise<CreateTeamResult> {
  const action = "createTeam";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  const teamName = validateTeamName(name);
  if (!teamName) return fail("invalid_name");

  const admin = createAdminClient();
  // 1. teams
  const created = await withFreshInviteCode<{ id: string }>((code) =>
    admin
      .from("teams")
      .insert({ name: teamName, invite_code: code, created_by: user.id, created_via: "home" })
      .select("id")
      .single(),
  );
  if (!created.ok || !created.data) {
    const reason = created.ok ? "write_failed" : created.reason;
    logTeamError(action, "team insert failed", { userId: user.id }, created.ok ? null : created.error);
    return fail(reason);
  }
  const teamId = created.data.id;

  // 2. The caller is the owner and, for now, the only member.
  const { error: ownerError } = await admin
    .from("team_members")
    .insert({ team_id: teamId, user_id: user.id, display_name: user.nickname, role: "owner" });
  if (ownerError) {
    logTeamError(action, "owner insert failed", { teamId, userId: user.id }, ownerError);
    await rollbackTeam(admin, action, teamId);
    return fail("write_failed");
  }

  revalidatePath("/");
  return { success: true, teamId };
}

// ============================================================
// 기존 방을 밴드에 넣기 (CEO-F2, 디자인 13A)
// ============================================================

/**
 * 방 설정의 "이 플레이리스트를 내 밴드에 넣기"와 /new 완료 화면의 "이 플레이리스트를 밴드에 넣을까요?".
 * 방장이면서 그 밴드 멤버여야 한다. 방의 참여자를 밴드 멤버로 넣지는 않는다(가입은 초대 링크로만).
 */
export async function attachPlaylistToTeam(
  playlistId: string,
  teamId: string,
): Promise<AttachPlaylistToTeamResult> {
  const action = "attachPlaylistToTeam";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");

  const admin = createAdminClient();
  const [blocked, { data: room, error: roomError }, membership] = await Promise.all([
    roomWriteBlock(playlistId),
    admin
      .from("playlists")
      .select("id, share_code, creator_user_id, team_id")
      .eq("id", playlistId)
      .maybeSingle(),
    readMyRole(admin, teamId, user.id),
  ]);
  if (blocked) return fail(blocked);
  if (roomError || !membership.ok) {
    logTeamError(action, "lookup failed", { playlistId, teamId, userId: user.id }, roomError ?? (membership.ok ? null : membership.error));
    return fail("write_failed");
  }
  if (!room) return fail("playlist_not_found");
  if (room.creator_user_id !== user.id) return fail("not_room_owner");
  if (room.team_id) return fail("already_in_team");
  if (!membership.role) return fail("not_member");

  const { data: linked, error: linkError } = await admin
    .from("playlists")
    .update({ team_id: teamId, team_linked_via: "attach" })
    .eq("id", playlistId)
    .is("team_id", null)
    .select("id");
  if (linkError) {
    logTeamError(action, "room link failed", { playlistId, teamId }, linkError);
    return fail("write_failed");
  }
  if (!linked || linked.length === 0) return fail("already_in_team");

  revalidatePath(`/playlist/${room.share_code}`);
  revalidatePath(`/band/${teamId}`);
  return { success: true, teamId };
}

// ============================================================
// 가입
// ============================================================

/**
 * 초대 화면의 "밴드 들어가기" (로그인 복귀 자동 가입도 이 액션을 한 번 부른다).
 * 이미 멤버면 아무것도 바꾸지 않고 성공으로 돌려준다(ON CONFLICT DO NOTHING 과 같은 결과).
 * owner 의 역할을 덮어쓰지 않도록 upsert 가 아니라 insert + 23505 무시로 한다.
 */
export async function joinTeam(inviteCode: string): Promise<JoinTeamResult> {
  const action = "joinTeam";
  if (!isInviteCodeFormat(inviteCode)) return fail("invite_not_found");
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");

  const admin = createAdminClient();
  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (teamError) {
    logTeamError(action, "team lookup failed", { userId: user.id }, teamError);
    return fail("write_failed");
  }
  if (!team) return fail("invite_not_found");

  const { error: insertError } = await admin.from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    display_name: user.nickname,
    role: "member",
  });
  if (insertError?.code === "23505") {
    return { success: true, teamId: team.id, alreadyMember: true };
  }
  if (insertError) {
    logTeamError(action, "team_members insert failed", { teamId: team.id, userId: user.id }, insertError);
    return fail("write_failed");
  }

  revalidatePath(`/band/${team.id}`);
  return { success: true, teamId: team.id, alreadyMember: false };
}

// ============================================================
// 읽기
// ============================================================

/**
 * /join/[inviteCode] 초대 화면. 없는 코드(또는 형식이 아닌 코드)는 null → notFound().
 * 비멤버에게는 이름·멤버 수·앞 3명 이름·공연 날짜만 준다. 방 목록·멤버 전체 이름은 주지 않는다.
 * 예상 못한 조회 에러는 throw 한다 (에러 화면).
 */
export async function getTeamInvite(inviteCode: string): Promise<TeamInviteView | null> {
  if (!isInviteCodeFormat(inviteCode)) return null;

  const admin = createAdminClient();
  const [user, { data: team, error: teamError }] = await Promise.all([
    getCurrentUser(),
    admin
      .from("teams")
      .select("id, name, next_show_at")
      .eq("invite_code", inviteCode)
      .maybeSingle(),
  ]);
  if (teamError) {
    logTeamError("getTeamInvite", "team lookup failed", {}, teamError);
    throw new Error("밴드를 불러오지 못했어요.");
  }
  if (!team) return null;

  const { data: members, error: membersError } = await admin
    .from("team_members")
    .select("user_id, display_name, role, joined_at")
    .eq("team_id", team.id);
  if (membersError) {
    logTeamError("getTeamInvite", "members lookup failed", { teamId: team.id }, membersError);
    throw new Error("밴드를 불러오지 못했어요.");
  }
  const rows = (members ?? []) as {
    user_id: string;
    display_name: string;
    role: TeamRole;
    joined_at: string | null;
  }[];

  if (user && rows.some((member) => member.user_id === user.id)) {
    return { status: "member", teamId: team.id, name: team.name };
  }
  return {
    status: "invite",
    loggedIn: !!user,
    name: team.name,
    memberCount: rows.length,
    previewNames: previewMemberNames(rows),
    nextShowAt: team.next_show_at ?? null,
  };
}

/**
 * /band/[teamId] 밴드 홈. 없는 밴드(또는 형식이 아닌 id)는 null → notFound().
 * 멤버가 아니면 밴드 이름만 준다. 멤버에게는 방 목록과 E1 셋리스트 이력, 멤버, 초대 코드를 준다.
 * 이력은 방마다 따로 읽지 않고 setlist_items 를 .in() 한 번으로 읽는다.
 * 예상 못한 조회 에러는 throw 한다 (error.tsx).
 */
export async function getTeamHome(teamId: string): Promise<TeamHomeView | null> {
  if (!isTeamIdFormat(teamId)) return null;
  const action = "getTeamHome";

  const admin = createAdminClient();
  const [user, teamRes, membersRes, roomsRes] = await Promise.all([
    getCurrentUser(),
    admin
      .from("teams")
      .select("id, name, invite_code, next_show_at, created_at")
      .eq("id", teamId)
      .maybeSingle(),
    admin
      .from("team_members")
      .select("user_id, display_name, role, joined_at")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true }),
    admin
      .from("playlists")
      .select("id, share_code, title, created_at, setlist_confirmed")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
  ]);
  const firstError = teamRes.error ?? membersRes.error ?? roomsRes.error;
  if (firstError) {
    logTeamError(action, "lookup failed", { teamId }, firstError);
    throw new Error("밴드를 불러오지 못했어요.");
  }
  const team = teamRes.data;
  if (!team) return null;

  const members = sortMembersForDisplay(
    (membersRes.data ?? []) as {
      user_id: string;
      display_name: string;
      role: TeamRole;
      joined_at: string;
    }[],
  );
  const me = user ? members.find((member) => member.user_id === user.id) : undefined;
  if (!me) {
    return { access: "guest", loggedIn: !!user, team: { id: team.id, name: team.name } };
  }

  const rooms = (roomsRes.data ?? []) as {
    id: string;
    share_code: string;
    title: string;
    created_at: string;
    setlist_confirmed: boolean | null;
  }[];

  const setlistByRoom = new Map<string, TeamSetlistSong[]>();
  const songsByRoom = new Map<string, { thumbnailUrl: string | null }[]>();
  if (rooms.length > 0) {
    const roomIds = rooms.map((room) => room.id);
    const [{ data: items, error: itemsError }, { data: roomSongs, error: songsError }] = await Promise.all([
      admin
        .from("setlist_items")
        .select(
          "playlist_id, position, item_type, song_id, title_override, songs(title, artist, youtube_video_id, thumbnail_url)",
        )
        .in("playlist_id", roomIds)
        .eq("item_type", "song")
        .order("position", { ascending: true }),
      admin
        .from("songs")
        .select("playlist_id, thumbnail_url")
        .in("playlist_id", roomIds)
        .order("created_at", { ascending: false }),
    ]);
    if (itemsError) {
      logTeamError(action, "setlist lookup failed", { teamId }, itemsError);
      throw new Error("밴드를 불러오지 못했어요.");
    }
    type SongRef = { title: string; artist: string | null; youtube_video_id: string | null; thumbnail_url: string | null };
    type ItemRow = {
      playlist_id: string;
      position: number;
      item_type: string;
      song_id: string | null;
      title_override: string | null;
      songs: SongRef | SongRef[] | null;
    };
    for (const item of (items ?? []) as ItemRow[]) {
      // Interval blocks and songs deleted later (song_id SET NULL) are not part of the history.
      const song = nestedRows(item.songs)[0];
      if (item.item_type !== "song" || !item.song_id || !song) continue;
      const list = setlistByRoom.get(item.playlist_id) ?? [];
      list.push({
        songId: item.song_id,
        title: item.title_override || song.title,
        artist: song.artist ?? null,
        position: item.position,
        videoId: song.youtube_video_id ?? null,
        thumbnailUrl: song.thumbnail_url ?? null,
      });
      setlistByRoom.set(item.playlist_id, list);
    }

    // Covers and counts are decoration: a failed read shows plain covers, not an error page.
    if (songsError) {
      logTeamError(action, "room songs lookup failed", { teamId }, songsError);
    } else {
      for (const row of (roomSongs ?? []) as { playlist_id: string; thumbnail_url: string | null }[]) {
        const list = songsByRoom.get(row.playlist_id) ?? [];
        list.push({ thumbnailUrl: row.thumbnail_url });
        songsByRoom.set(row.playlist_id, list);
      }
    }
  }

  const isOwner = me.role === "owner";
  return {
    access: "member",
    myRole: me.role,
    team: {
      id: team.id,
      name: team.name,
      inviteCode: team.invite_code,
      nextShowAt: team.next_show_at ?? null,
      createdAt: team.created_at,
    },
    members: members.map((member) => ({
      userId: isOwner ? member.user_id : null,
      displayName: member.display_name,
      role: member.role,
      joinedAt: member.joined_at,
      isMe: member.user_id === me.user_id,
    })),
    rooms: rooms.map((room) => {
      const setlist = (setlistByRoom.get(room.id) ?? []).sort((a, b) => a.position - b.position);
      const songs = songsByRoom.get(room.id) ?? [];
      return {
        id: room.id,
        shareCode: room.share_code,
        title: room.title,
        createdAt: room.created_at,
        setlistConfirmed: !!room.setlist_confirmed,
        setlist,
        songCount: songs.length,
        coverThumbs: roomCoverThumbs(setlist, songs),
      };
    }),
  };
}

export interface MyTeamsResult {
  teams: MyTeam[];
  /** 조회 실패. 홈은 '밴드 없음'과 구분해 오류를 보인다(DR7, eng E1). */
  failed: boolean;
}

/**
 * 홈 "내 밴드"와 방 설정의 "이 플레이리스트를 내 밴드에 넣기" 후보. 비로그인은 빈 목록.
 * 조회가 실패하면 빈 목록 + failed (+ console.error). 부르는 곳이 failed 를 어떻게 다룰지 정한다.
 */
export async function getMyTeams(): Promise<MyTeamsResult> {
  const user = await getCurrentUser();
  if (!user) return { teams: [], failed: false };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("role, joined_at, teams(id, name, next_show_at, playlists(count))")
    .eq("user_id", user.id);
  if (error) {
    logTeamError("getMyTeams", "lookup failed", { userId: user.id }, error);
    return { teams: [], failed: true };
  }

  type TeamRow = {
    id: string;
    name: string;
    next_show_at: string | null;
    playlists: { count: number }[] | { count: number } | null;
  };
  type Row = { role: TeamRole; joined_at: string | null; teams: TeamRow | TeamRow[] | null };

  const teams = ((data ?? []) as Row[])
    .flatMap((row) =>
      nestedRows(row.teams).map((team) => ({
        joinedAt: row.joined_at ?? "",
        team: {
          id: team.id,
          name: team.name,
          nextShowAt: team.next_show_at ?? null,
          role: row.role,
          roomCount: nestedRows(team.playlists)[0]?.count ?? 0,
        },
      })),
    )
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map((entry) => entry.team);
  return { teams, failed: false };
}

// ============================================================
// 밴드에서 새 합주방
// ============================================================

/**
 * 밴드 홈 "새 합주방" → /new?band={teamId} 의 제출. 지금의 createPlaylist 와 같은 방을 만들고
 * team_id·team_linked_via='band' 를 같은 insert 에 싣는다. 방 만들기 쓰기 단계는 insertRoom 을 함께 쓴다.
 *
 * 멤버 확인과 insert 사이에 내보내기가 끼면 비멤버가 방을 하나 만들 수 있다.
 * 그래서 insert 뒤에 멤버십을 다시 확인하고, 아니면 만든 방을 지운다 (계획 Section 4).
 */
export async function createBandPlaylist(
  teamId: string,
  title: string,
  deadline?: string,
  setlistCount?: number,
  votingMode: VotingMode = "free",
  defaultVoteLimit = 3,
): Promise<CreateBandPlaylistResult> {
  const action = "createBandPlaylist";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  // Same rules as createPlaylist, returned instead of thrown.
  if (!title || title.length > 100) return fail("invalid_title");
  if (votingMode !== "free" && votingMode !== "allocated") return fail("invalid_voting_mode");
  if (!Number.isInteger(defaultVoteLimit) || defaultVoteLimit < 1 || defaultVoteLimit > 99) {
    return fail("invalid_vote_limit");
  }
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");

  const admin = createAdminClient();
  const [{ data: team, error: teamError }, membership] = await Promise.all([
    admin.from("teams").select("id").eq("id", teamId).maybeSingle(),
    readMyRole(admin, teamId, user.id),
  ]);
  if (teamError || !membership.ok) {
    logTeamError(action, "lookup failed", { teamId, userId: user.id }, teamError ?? (membership.ok ? null : membership.error));
    return fail("write_failed");
  }
  if (!team) return fail("team_not_found");
  if (!membership.role) return fail("not_member");

  const room = await insertRoom({
    title,
    deadline,
    setlistCount,
    votingMode,
    defaultVoteLimit,
    creator: { id: user.id, nickname: user.nickname },
    team: { id: teamId, linkedVia: "band" },
  });
  if (!room.ok) {
    logTeamError(action, `room insert failed (${room.reason})`, { teamId, userId: user.id });
    return fail("write_failed");
  }

  // Re-check: the caller may have been removed between the first check and the insert.
  const recheck = await readMyRole(admin, teamId, user.id);
  if (!recheck.ok || !recheck.role) {
    const { error: deleteError } = await admin.from("playlists").delete().eq("id", room.id);
    if (deleteError) {
      logTeamError(action, "cleanup delete failed, room left in band", { teamId, playlistId: room.id }, deleteError);
    }
    if (!recheck.ok) {
      logTeamError(action, "membership recheck failed", { teamId, playlistId: room.id }, recheck.error);
      return fail("write_failed");
    }
    return fail("not_member");
  }

  revalidatePath(`/band/${teamId}`);
  return { success: true, id: room.id, shareCode: room.shareCode, adminToken: room.adminToken };
}

// ============================================================
// 다음 공연 날짜 (E2)
// ============================================================

/**
 * 멤버 누구나 다음 공연 날짜를 정하거나(YYYY-MM-DD, KST 오늘 이후) 지운다(null).
 * 동시에 고치면 마지막 저장이 이긴다.
 */
export async function updateTeamNextShow(
  teamId: string,
  nextShowAt: string | null,
): Promise<UpdateTeamNextShowResult> {
  const action = "updateTeamNextShow";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  if (nextShowAt !== null) {
    const invalid = validateNextShowDate(nextShowAt, new Date());
    if (invalid) return fail(invalid);
  }
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");

  const admin = createAdminClient();
  const membership = await readMyRole(admin, teamId, user.id);
  if (!membership.ok) {
    logTeamError(action, "membership lookup failed", { teamId, userId: user.id }, membership.error);
    return fail("write_failed");
  }
  if (!membership.role) return fail("not_member");

  const { data: updated, error } = await admin
    .from("teams")
    .update({ next_show_at: nextShowAt })
    .eq("id", teamId)
    .select("id");
  if (error) {
    logTeamError(action, "update failed", { teamId }, error);
    return fail("write_failed");
  }
  if (!updated || updated.length === 0) return fail("team_not_found");

  revalidatePath(`/band/${teamId}`);
  return { success: true, nextShowAt };
}

// ============================================================
// 멤버 관리 (CEO-F1) · 밴드 나가기 (R12)
// ============================================================

/**
 * owner 의 "링크 새로 만들기". 옛 /join/{옛 코드} 와 이미 돈 카톡 카드는 바로 죽는다.
 * 멤버 주소 /band/{teamId} 는 그대로다 (R10). 성공하면 새 코드를 돌려준다 (R7).
 */
export async function regenerateInviteCode(teamId: string): Promise<RegenerateInviteCodeResult> {
  const action = "regenerateInviteCode";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");

  const admin = createAdminClient();
  const membership = await readMyRole(admin, teamId, user.id);
  if (!membership.ok) {
    logTeamError(action, "membership lookup failed", { teamId, userId: user.id }, membership.error);
    return fail("write_failed");
  }
  if (membership.role !== "owner") return fail("not_team_owner");

  const rotated = await withFreshInviteCode<{ id: string }[]>((code) =>
    admin.from("teams").update({ invite_code: code }).eq("id", teamId).select("id"),
  );
  if (!rotated.ok) {
    logTeamError(action, "rotate failed", { teamId }, rotated.error);
    return fail(rotated.reason);
  }
  if (!rotated.data || rotated.data.length === 0) return fail("team_not_found");

  revalidatePath(`/band/${teamId}`);
  return { success: true, inviteCode: rotated.code };
}

/**
 * owner 의 "내보내기". 밴드에서만 뺀다 — 그 사람이 이미 들어간 방의 참여자 자격은 그대로다(얕은 결합).
 *
 * `rotateInvite` 를 켜면 순서가 계약이다: 링크를 먼저 바꾸고 그다음 지운다.
 *   교체 ─▶ 삭제. 교체 전에 옛 코드로 다시 들어왔다면 뒤이은 삭제가 지우고,
 *   교체 뒤의 가입은 옛 코드라 실패한다. 반대 순서면 그 사이에 다시 들어올 수 있다.
 * 교체는 됐는데 삭제가 실패하면 success:false 와 함께 새 코드를 돌려준다(옛 링크는 이미 죽었다).
 */
export async function removeTeamMember(
  teamId: string,
  targetUserId: string,
  rotateInvite = false,
): Promise<RemoveTeamMemberResult> {
  const action = "removeTeamMember";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");
  if (targetUserId === user.id) return fail("cannot_remove_self");

  const admin = createAdminClient();
  const { data: rows, error: lookupError } = await admin
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId)
    .in("user_id", [user.id, targetUserId]);
  if (lookupError) {
    logTeamError(action, "membership lookup failed", { teamId, userId: user.id }, lookupError);
    return fail("write_failed");
  }
  const found = (rows ?? []) as { user_id: string; role: TeamRole }[];
  const mine = found.find((row) => row.user_id === user.id);
  if (mine?.role !== "owner") return fail("not_team_owner");
  const target = found.find((row) => row.user_id === targetUserId);
  if (!target || target.role !== "member") return fail("member_not_found");

  // 1. Rotate first (only when asked).
  let inviteCode: string | null = null;
  if (rotateInvite) {
    const rotated = await withFreshInviteCode<{ id: string }[]>((code) =>
      admin.from("teams").update({ invite_code: code }).eq("id", teamId).select("id"),
    );
    if (!rotated.ok) {
      logTeamError(action, "rotate failed, nobody removed", { teamId }, rotated.error);
      return fail(rotated.reason);
    }
    if (!rotated.data || rotated.data.length === 0) return fail("team_not_found");
    inviteCode = rotated.code;
  }

  // 2. Then remove.
  const { data: removed, error: removeError } = await admin
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", targetUserId)
    .eq("role", "member")
    .select("user_id");
  if (removeError || !removed || removed.length === 0) {
    if (removeError) {
      logTeamError(action, "delete failed", { teamId, targetUserId, rotated: inviteCode ? "yes" : "no" }, removeError);
    }
    const reason: RemoveTeamMemberReason = removeError
      ? inviteCode
        ? "invite_rotated_remove_failed"
        : "write_failed"
      : "member_not_found";
    if (inviteCode) revalidatePath(`/band/${teamId}`);
    return inviteCode ? { success: false, reason, inviteCode } : fail(reason);
  }

  revalidatePath(`/band/${teamId}`);
  return { success: true, inviteCode };
}

/**
 * owner 가 아닌 멤버의 "밴드 나가기". 자기 행만 지운다. owner 는 나갈 수 없다(이전 경로가 없다).
 * 이미 들어간 방은 그대로 남는다(내보내기와 같음).
 */
export async function leaveTeam(teamId: string): Promise<LeaveTeamResult> {
  const action = "leaveTeam";
  const user = await getCurrentUser();
  if (!user) return fail("not_logged_in");
  if (!isTeamIdFormat(teamId)) return fail("team_not_found");

  const admin = createAdminClient();
  const membership = await readMyRole(admin, teamId, user.id);
  if (!membership.ok) {
    logTeamError(action, "membership lookup failed", { teamId, userId: user.id }, membership.error);
    return fail("write_failed");
  }
  if (!membership.role) return fail("not_member");
  if (membership.role === "owner") return fail("owner_cannot_leave");

  const { data: removed, error } = await admin
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .eq("role", "member")
    .select("user_id");
  if (error) {
    logTeamError(action, "delete failed", { teamId, userId: user.id }, error);
    return fail("write_failed");
  }
  if (!removed || removed.length === 0) return fail("not_member");

  revalidatePath(`/band/${teamId}`);
  return { success: true };
}
