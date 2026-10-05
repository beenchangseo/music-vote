#!/usr/bin/env node
// 밴드(팀) 성공 지표를 DB 에 이미 있는 행동 기록으로 센다. 읽기 전용이다 — select 만 한다.
//
//   npm run metrics:teams
//
// 정의는 docs/plans/2026-09-21-teams-and-shared-catalog.md "성공 지표 (CEO-B)" 그대로다.
//   - 활동의 기간: created_at ≥ max(teams.created_at, 팀 기능 배포일) 인 행만 센다.
//     옛 방을 밴드에 넣어도(attach) 과거 투표로 지표가 채워지지 않게 한다.
//   - 외부 밴드: owner 가 운영자 계정(METRICS_OPERATOR_IDS)도 테스트 계정(E2E_ACCOUNT_IDS)도 아닌 밴드.
//   - 제외: 테스트 계정(E2E_ACCOUNT_IDS)이 owner 이거나 멤버인 밴드는 모든 지표에서 뺀다.
//   - owner 가 아닌 멤버: team_members.role = 'member'.
//   - 밴드에서 만든 새 방: playlists.team_linked_via = 'band' (밴드 홈 "새 합주방").
//     붙인 방('attach')·밴드로 올린 원래 방('promote')은 빠지고, "팀 생성 뒤 만들어 붙인 방"은 따로 출력한다.
//   - 활동은 투표(votes)·곡 추가(songs)·댓글(comments), 날짜는 KST.
//
// 환경 변수 (.env 를 읽고 .env.local 이 덮어쓴다. 셸 환경 변수가 가장 우선)
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  필수
//   E2E_ACCOUNT_IDS        테스트 계정 user id, 쉼표 구분 (e2e/README.md 와 같은 값)
//   METRICS_OPERATOR_IDS   운영자(방장 본인) user id, 쉼표 구분. 외부 밴드 판정에만 쓴다
//   TEAM_LAUNCH_DATE       팀 기능 배포일 YYYY-MM-DD (KST). 없으면 밴드 생성 시각만으로 기간을 자른다
//
// 키·URL·user id 는 출력하지 않는다. 밴드 이름은 운영자 확인용으로 출력한다.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 타임스탬프의 KST 달력 날짜 (YYYY-MM-DD). */
export function kstDate(timestamp) {
  return new Date(new Date(timestamp).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 날짜 YYYY-MM-DD 의 자정을 epoch ms 로. 형식이 아니면 null. */
export function kstMidnightMs(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - KST_OFFSET_MS;
}

export function parseIdList(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * 순수 계산. 테스트가 고정 데이터로 부른다.
 *
 * data: { teams, teamMembers, playlists, songs, votes, comments } — DB 행 그대로
 *   teams        { id, name, created_at, created_by, next_show_at }
 *   teamMembers  { team_id, user_id, role }
 *   playlists    { id, team_id, team_linked_via, creator_user_id, created_at }   (team_id 가 있는 방만)
 *   songs        { id, playlist_id, added_by_user_id, created_at }
 *   votes        { song_id, user_id, created_at }
 *   comments     { song_id, user_id, created_at }
 * options: { e2eIds: Set, operatorIds: Set, launchDate: "YYYY-MM-DD" | null }
 */
export function computeTeamMetrics(data, options) {
  const e2eIds = options.e2eIds ?? new Set();
  const operatorIds = options.operatorIds ?? new Set();
  const launchMs = options.launchDate ? kstMidnightMs(options.launchDate) : null;

  const membersByTeam = groupBy(data.teamMembers, (row) => row.team_id);
  const roomsByTeam = groupBy(
    data.playlists.filter((room) => room.team_id),
    (room) => room.team_id,
  );
  const songById = new Map(data.songs.map((song) => [song.id, song]));
  const songsByRoom = groupBy(data.songs, (song) => song.playlist_id);
  const votesByRoom = groupBy(
    data.votes.filter((vote) => songById.has(vote.song_id)),
    (vote) => songById.get(vote.song_id).playlist_id,
  );
  const commentsByRoom = groupBy(
    data.comments.filter((comment) => songById.has(comment.song_id)),
    (comment) => songById.get(comment.song_id).playlist_id,
  );

  const excluded = [];
  const bands = [];
  for (const team of data.teams) {
    const members = membersByTeam.get(team.id) ?? [];
    if (members.some((member) => e2eIds.has(member.user_id)) || e2eIds.has(team.created_by)) {
      excluded.push(team);
      continue;
    }
    const ownerId = members.find((member) => member.role === "owner")?.user_id ?? team.created_by ?? null;
    const periodStartMs = Math.max(new Date(team.created_at).getTime(), launchMs ?? -Infinity);
    const inPeriod = (row) => new Date(row.created_at).getTime() >= periodStartMs;
    const memberIds = new Set(members.map((member) => member.user_id));
    const plainMemberIds = new Set(members.filter((member) => member.role === "member").map((member) => member.user_id));
    const rooms = roomsByTeam.get(team.id) ?? [];

    // Activity days per plain member, across every room of the band.
    const daysByMember = new Map();
    const addDay = (userId, row) => {
      if (!userId || !plainMemberIds.has(userId) || !inPeriod(row)) return;
      if (!daysByMember.has(userId)) daysByMember.set(userId, new Set());
      daysByMember.get(userId).add(kstDate(row.created_at));
    };
    for (const room of rooms) {
      for (const song of songsByRoom.get(room.id) ?? []) addDay(song.added_by_user_id, song);
      for (const vote of votesByRoom.get(room.id) ?? []) addDay(vote.user_id, vote);
      for (const comment of commentsByRoom.get(room.id) ?? []) addDay(comment.user_id, comment);
    }
    const maxMemberActiveDays = Math.max(0, ...[...daysByMember.values()].map((days) => days.size));

    const bandRooms = rooms.filter((room) => room.team_linked_via === "band");
    let nonCreatorMemberVotes = 0;
    for (const room of bandRooms) {
      for (const vote of votesByRoom.get(room.id) ?? []) {
        if (!vote.user_id || vote.user_id === room.creator_user_id) continue;
        if (!memberIds.has(vote.user_id) || !inPeriod(vote)) continue;
        nonCreatorMemberVotes += 1;
      }
    }

    const teamCreatedMs = new Date(team.created_at).getTime();
    bands.push({
      id: team.id,
      name: team.name,
      external: !!ownerId && !operatorIds.has(ownerId),
      memberCount: members.length,
      hasNextShow: !!team.next_show_at,
      maxMemberActiveDays,
      bandRoomCount: bandRooms.length,
      nonCreatorMemberVotes,
      promotedRoomCount: rooms.filter((room) => room.team_linked_via === "promote").length,
      attachedAfterCreationCount: rooms.filter(
        (room) => room.team_linked_via === "attach" && new Date(room.created_at).getTime() > teamCreatedMs,
      ).length,
      attachedOlderRoomCount: rooms.filter(
        (room) => room.team_linked_via === "attach" && new Date(room.created_at).getTime() <= teamCreatedMs,
      ).length,
    });
  }

  const sum = (pick) => bands.reduce((total, band) => total + pick(band), 0);
  return {
    excludedBandCount: excluded.length,
    bands,
    // 배포 + 6주
    bandsCreated: bands.length,
    externalBandsCreated: bands.filter((band) => band.external).length,
    bandsWithMemberActiveTwoDays: bands.filter((band) => band.maxMemberActiveDays >= 2).length,
    // 배포 + 3.5개월
    bandsWithBandRoom: bands.filter((band) => band.bandRoomCount >= 1).length,
    nonCreatorMemberVotesInBandRooms: sum((band) => band.nonCreatorMemberVotes),
    // 상시
    bandsWithNextShow: bands.filter((band) => band.hasNextShow).length,
    // 참고 (R13)
    bandRoomCount: sum((band) => band.bandRoomCount),
    attachedAfterCreationCount: sum((band) => band.attachedAfterCreationCount),
    bandsWithAttachedAfterCreation: bands.filter((band) => band.attachedAfterCreationCount >= 1).length,
    attachedOlderRoomCount: sum((band) => band.attachedOlderRoomCount),
    promotedRoomCount: sum((band) => band.promotedRoomCount),
  };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = key(row);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

// ============================================================
// DB 읽기 (select 만)
// ============================================================

const PAGE = 1000;
const IN_CHUNK = 200;

async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(`조회 실패 (${error.code ?? "unknown"})`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function selectIn(admin, table, columns, column, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    rows.push(...(await selectAll(() => admin.from(table).select(columns).in(column, chunk))));
  }
  return rows;
}

async function loadData(admin) {
  const [teams, teamMembers, playlists] = await Promise.all([
    selectAll(() => admin.from("teams").select("id, name, created_at, created_by, next_show_at").order("created_at")),
    selectAll(() => admin.from("team_members").select("team_id, user_id, role").order("team_id")),
    selectAll(() =>
      admin
        .from("playlists")
        .select("id, team_id, team_linked_via, creator_user_id, created_at")
        .not("team_id", "is", null)
        .order("created_at"),
    ),
  ]);
  const songs = await selectIn(
    admin,
    "songs",
    "id, playlist_id, added_by_user_id, created_at",
    "playlist_id",
    playlists.map((room) => room.id),
  );
  const songIds = songs.map((song) => song.id);
  const [votes, comments] = await Promise.all([
    selectIn(admin, "votes", "song_id, user_id, created_at", "song_id", songIds),
    selectIn(admin, "comments", "song_id, user_id, created_at", "song_id", songIds),
  ]);
  return { teams, teamMembers, playlists, songs, votes, comments };
}

// ============================================================
// 출력
// ============================================================

function line(label, value, target = "") {
  console.log(`  ${label.padEnd(44)} ${String(value).padStart(8)}   ${target}`);
}

function ratio(part, whole) {
  return whole === 0 ? "0/0" : `${part}/${whole} (${Math.round((part / whole) * 100)}%)`;
}

function printReport(metrics, { launchDate, now }) {
  console.log("밴드 성공 지표 (CEO-B)\n");
  console.log(`  기준 시각: ${kstDate(now)} KST`);
  if (launchDate) {
    const weeks = Math.floor((now.getTime() - kstMidnightMs(launchDate)) / (7 * 24 * 60 * 60 * 1000));
    console.log(`  팀 기능 배포일: ${launchDate} (배포 + ${weeks}주)`);
  } else {
    console.log("  팀 기능 배포일: 미설정 — TEAM_LAUNCH_DATE 가 없어 밴드 생성 시각으로만 기간을 자릅니다");
  }
  console.log(`  제외한 밴드 (테스트 계정이 owner·멤버): ${metrics.excludedBandCount}개\n`);

  console.log("배포 + 6주");
  line("만들어진 밴드 (외부)", `${metrics.bandsCreated} (${metrics.externalBandsCreated})`, "목표 ≥ 5 (외부 ≥ 1)");
  line("owner 아닌 멤버가 서로 다른 날 2일 이상 활동한 밴드", metrics.bandsWithMemberActiveTwoDays, "목표 ≥ 2");

  console.log("\n배포 + 3.5개월 (공연 한 주기)");
  line("밴드에서 만든 새 방이 1개 이상인 밴드", metrics.bandsWithBandRoom, "목표 ≥ 2");
  line("밴드에서 만든 새 방에서 만든 사람 아닌 멤버의 투표", metrics.nonCreatorMemberVotesInBandRooms, "목표 ≥ 1회");

  console.log("\n상시 (관찰만)");
  line("song_meta_prefilled (E4)", "—", "DB 에 없음. Vercel Analytics 대시보드에서 본다");
  line("next_show_at 을 정한 밴드 비율 (E2)", ratio(metrics.bandsWithNextShow, metrics.bandsCreated));

  console.log("\n참고 (방이 밴드에 들어온 경로)");
  line("밴드에서 만든 새 방 (band)", metrics.bandRoomCount);
  line("팀 생성 뒤 만들어 붙인 방 (attach)", `${metrics.attachedAfterCreationCount}`, `밴드 ${metrics.bandsWithAttachedAfterCreation}개`);
  line("팀 생성 전 방을 붙인 것 (attach)", metrics.attachedOlderRoomCount);
  line("밴드로 올린 원래 방 (promote)", metrics.promotedRoomCount);

  if (metrics.bands.length > 0) {
    console.log("\n밴드별");
    for (const band of metrics.bands) {
      console.log(
        `  ${band.name}${band.external ? " [외부]" : ""} — 멤버 ${band.memberCount}, 새 방 ${band.bandRoomCount}, ` +
          `멤버 최다 활동일 ${band.maxMemberActiveDays}, 새 방 멤버 투표 ${band.nonCreatorMemberVotes}`,
      );
    }
  }
}

// ============================================================
// 실행
// ============================================================

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((entry) => entry.includes("=") && !entry.trim().startsWith("#"))
        .map((entry) => {
          const i = entry.indexOf("=");
          return [entry.slice(0, i).trim(), entry.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const e2eIds = parseIdList(env.E2E_ACCOUNT_IDS);
  const operatorIds = parseIdList(env.METRICS_OPERATOR_IDS);
  const launchDate = env.TEAM_LAUNCH_DATE || null;
  if (launchDate && kstMidnightMs(launchDate) === null) {
    console.error("TEAM_LAUNCH_DATE 는 YYYY-MM-DD 형식이어야 합니다.");
    process.exit(1);
  }
  if (e2eIds.size === 0) {
    console.warn("경고: E2E_ACCOUNT_IDS 가 비어 있어 테스트 계정 밴드를 빼지 못합니다.\n");
  }
  const overlap = [...operatorIds].filter((id) => e2eIds.has(id)).length;
  if (overlap > 0) {
    console.warn(
      `경고: METRICS_OPERATOR_IDS 와 E2E_ACCOUNT_IDS 에 같은 계정이 ${overlap}개 있습니다. ` +
        "그 계정이 owner·멤버인 밴드는 테스트 계정 규칙으로 모든 지표에서 빠집니다.\n",
    );
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const data = await loadData(admin);
  const metrics = computeTeamMetrics(data, { e2eIds, operatorIds, launchDate });
  printReport(metrics, { launchDate, now: new Date() });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "지표 계산에 실패했습니다.");
    process.exit(1);
  });
}
