import { describe, expect, it } from "vitest";
import { cumulativeStarts, effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, rehearsalSteps, setlistEditAccess, setlistPlayOrder, setlistRows, summarizeSetlist } from "../setlist";
import type { SetlistItem, SongWithScore } from "../types";
import { FIXTURE_SONG_COUNT, FIXTURE_TOTAL_SECONDS, fixtureItems, fixtureSongs } from "./setlist-fixture";

const song = { id: "song-1", title: "원본 제목", duration_seconds: 180 } as SongWithScore;
const base = { id: "item-1", playlist_id: "p", position: 0, item_type: "song", song_id: song.id, label: null, description: null, duration_seconds: 0, title_override: null, duration_override_seconds: null, created_at: "" } as SetlistItem;

describe("setlist domain", () => {
  it("uses overrides without changing the source song", () => {
    const item = { ...base, title_override: "공연용 제목", duration_override_seconds: 200 };
    expect(effectiveSetlistTitle(item, song)).toBe("공연용 제목");
    expect(effectiveSetlistDuration(item, song)).toBe(200);
    expect(song.title).toBe("원본 제목");
  });

  it.each([
    ["곡은 셋리스트에서 고친 시간이 먼저다", { duration_override_seconds: 200 }, 180, { songCount: 1, totalRuntime: 200, missingDurationCount: 0 }],
    ["시간 모르는 곡은 곡 수에 들고 시간 미입력으로 센다", {}, null, { songCount: 1, totalRuntime: 0, missingDurationCount: 1 }],
    ["시간 모르는 곡도 셋리스트에서 고친 시간이 있으면 그 시간이다", { duration_override_seconds: 150 }, null, { songCount: 1, totalRuntime: 150, missingDurationCount: 0 }],
    ["자작곡은 곡 수와 시간에 든다", { item_type: "original", song_id: null, duration_seconds: 225 }, 180, { songCount: 1, totalRuntime: 225, missingDurationCount: 0 }],
    ["시간 없는 자작곡은 시간 미입력이다", { item_type: "original", song_id: null, duration_seconds: 0 }, 180, { songCount: 1, totalRuntime: 0, missingDurationCount: 1 }],
    ["인터벌은 시간에만 든다", { item_type: "interval", song_id: null, duration_seconds: 180 }, 180, { songCount: 0, totalRuntime: 180, missingDurationCount: 0 }],
  ] as const)("%s", (_, fields, songDuration, expected) => {
    const items = [{ ...base, ...fields } as SetlistItem];
    expect(summarizeSetlist(items, [{ ...song, duration_seconds: songDuration }])).toEqual(expected);
  });

  it("formats totals over an hour", () => expect(formatRuntime(3723)).toBe("1:02:03"));
});

describe("cumulativeStarts", () => {
  const song = (id: string, duration_seconds: number | null) => ({ id, duration_seconds });
  const item = (
    id: string,
    item_type: "song" | "interval" | "original",
    extra: Partial<SetlistItem> = {},
  ) => ({
    id,
    playlist_id: "p",
    position: 0,
    item_type,
    song_id: item_type === "song" ? id : null,
    label: null,
    description: null,
    duration_seconds: 0,
    title_override: null,
    duration_override_seconds: null,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  }) as SetlistItem;

  it("앞선 항목들의 길이를 누적한다", () => {
    const items = [item("a", "song"), item("b", "song"), item("c", "song")];
    const songs = [song("a", 225), song("b", 209), song("c", 275)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 225, 434]);
  });

  it("인터벌 시간도 누적에 넣는다", () => {
    const items = [
      item("a", "song"),
      item("i", "interval", { duration_seconds: 300 }),
      item("b", "song"),
    ];
    const songs = [song("a", 200), song("b", 100)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 200, 500]);
  });

  it("자작곡 시간도 누적에 넣는다", () => {
    const items = [
      item("a", "song"),
      item("o", "original", { duration_seconds: 240 }),
      item("b", "song"),
    ];
    const songs = [song("a", 200), song("b", 100)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 200, 440]);
  });

  it("시간을 모르는 곡은 0으로 세고 이후 누적이 어긋난다", () => {
    const items = [item("a", "song"), item("b", "song"), item("c", "song")];
    const songs = [song("a", 100), song("b", null), song("c", 50)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 100, 100]);
  });

  it("셋리스트 전용 시간이 원본보다 우선한다", () => {
    const items = [item("a", "song", { duration_override_seconds: 60 }), item("b", "song")];
    const songs = [song("a", 300), song("b", 100)];
    expect(cumulativeStarts(items, songs)).toEqual([0, 60]);
  });

  it("빈 셋리스트를 견딘다", () => {
    expect(cumulativeStarts([], [])).toEqual([]);
  });
});

describe("한 셋리스트는 셋리스트 탭과 내보내기에서 같은 곡 수와 총 시간이다", () => {
  it("셋리스트 탭은 곡·자작곡·인터벌을 더하고 지워진 곡은 빼서 4곡 16:28 이다", () => {
    expect(summarizeSetlist(fixtureItems, fixtureSongs)).toEqual({
      songCount: FIXTURE_SONG_COUNT,
      totalRuntime: FIXTURE_TOTAL_SECONDS,
      missingDurationCount: 1,
    });
    expect(formatRuntime(FIXTURE_TOTAL_SECONDS)).toBe("16:28");
  });

  it("이미지·PDF 는 자작곡까지 셋리스트 탭과 같은 번호와 시간으로 그린다", () => {
    const rows = setlistRows(fixtureItems, fixtureSongs);
    expect(rows).toEqual([
      { kind: "interval", title: "사운드 체크", description: "모니터 볼륨 맞추기", duration: 120 },
      { kind: "song", number: 1, title: "첫 곡", artist: "첫 곡 밴드", bpm: null, duration: 200 },
      { kind: "interval", title: "기타 셋업 변경", description: null, duration: 180 },
      { kind: "song", number: 2, title: "시간 모르는 곡", artist: "시간 모르는 곡 밴드", bpm: null, duration: null },
      { kind: "original", number: 3, title: "우리 노래", description: "첫 자작곡", duration: 225 },
      { kind: "song", number: 4, title: "끝 곡", artist: "끝 곡 밴드", bpm: null, duration: 263 },
    ]);
    expect(rows.reduce((sum, row) => sum + (row.duration ?? 0), 0)).toBe(FIXTURE_TOTAL_SECONDS);
  });
});

describe("setlistEditAccess", () => {
  const host = { loggedIn: true, isHost: true };
  const member = { loggedIn: true, isHost: false };
  const visitor = { loggedIn: false, isHost: false };
  const tokenHost = { loggedIn: false, isHost: true };

  it.each([
    ["the host of a host-only room", "edit", { archived: false, mode: "host_only", ...host }],
    ["a member of a host-only room", "locked_to_host", { archived: false, mode: "host_only", ...member }],
    ["a logged-out visitor of a host-only room", "read_only", { archived: false, mode: "host_only", ...visitor }],
    ["the host of an everyone room", "edit", { archived: false, mode: "everyone", ...host }],
    ["a member of an everyone room", "edit", { archived: false, mode: "everyone", ...member }],
    ["a logged-out visitor of an everyone room", "read_only", { archived: false, mode: "everyone", ...visitor }],
    ["a member of an archived host-only room", "read_only", { archived: true, mode: "host_only", ...member }],
    ["a member of an archived everyone room", "read_only", { archived: true, mode: "everyone", ...member }],
    ["the token host of an archived host-only room", "read_only", { archived: true, mode: "host_only", ...tokenHost }],
    ["the token host of an archived everyone room", "read_only", { archived: true, mode: "everyone", ...tokenHost }],
  ] as const)("gives %s %s access", (_label, expected, input) => {
    expect(setlistEditAccess(input)).toBe(expected);
  });
});

describe("setlistPlayOrder", () => {
  const songs = ["a", "b", "c"].map((id) => ({ id }) as SongWithScore);
  const at = (position: number, fields: Partial<SetlistItem>) =>
    ({ ...base, id: `item-${position}`, position, ...fields }) as SetlistItem;
  const ids = (items: SetlistItem[]) => setlistPlayOrder(items, songs).map((song) => song.id);

  it.each([
    ["follows position, not the stored order", [at(1, { song_id: "a" }), at(0, { song_id: "c" })], ["c", "a"]],
    [
      "skips intervals and originals",
      [
        at(0, { item_type: "interval", song_id: null }),
        at(1, { song_id: "b" }),
        at(2, { item_type: "original", song_id: null }),
        at(3, { song_id: "a" }),
      ],
      ["b", "a"],
    ],
    ["skips a song deleted from the candidates", [at(0, { song_id: "gone" }), at(1, { song_id: "b" })], ["b"]],
    ["plays a song listed twice once", [at(0, { song_id: "a" }), at(1, { song_id: "b" }), at(2, { song_id: "a" })], ["a", "b"]],
    ["has nothing to play without song blocks", [at(0, { item_type: "interval", song_id: null })], []],
  ])("%s", (_name, items, expected) => {
    expect(ids(items)).toEqual(expected);
  });
});

describe("rehearsalSteps", () => {
  const songs = [
    { id: "a", title: "첫 곡", duration_seconds: 240 },
    { id: "b", title: "시간 모르는 곡", duration_seconds: null },
    { id: "c", title: "끝 곡", duration_seconds: 263 },
  ] as SongWithScore[];
  let position = 0;
  const at = (fields: Partial<SetlistItem>) => {
    position += 1;
    return { ...base, id: `item-${position}`, position, song_id: null, ...fields } as SetlistItem;
  };
  const songItem = (song_id: string, fields: Partial<SetlistItem> = {}) => at({ song_id, ...fields });
  const interval = (label: string | null, duration_seconds: number) => at({ item_type: "interval", label, duration_seconds });
  const original = (label: string | null, duration_seconds: number, description: string | null = null) =>
    at({ item_type: "original", label, description, duration_seconds });
  const deleted = () => at({ song_id: null });

  const summary = (items: SetlistItem[]) => {
    const { steps, trailing } = rehearsalSteps(items, songs);
    const intervals = (list: { title: string; duration: number }[]) => list.map((iv) => `${iv.title} ${iv.duration}`);
    return {
      steps: steps.map((step) => [intervals(step.before), step.kind, step.title, step.duration, step.remaining]),
      trailing: intervals(trailing),
    };
  };

  it.each([
    [
      "곡만 있으면 곡마다 한 장이고 남은 시간은 그 곡부터 끝까지다",
      () => [songItem("a"), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 503], [[], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "자작곡은 곡처럼 한 장이고 진행에 든다",
      () => [songItem("a"), original("우리 노래", 225), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 728], [[], "original", "우리 노래", 225, 488], [[], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "이름 없는 자작곡은 '자작곡'이고 시간 없는 자작곡은 시간 미입력이다",
      () => [original(null, 0)],
      { steps: [[[], "original", "자작곡", null, 0]], trailing: [] },
    ],
    [
      "맨 앞 인터벌은 장이 아니고 첫 장 앞에 붙어 첫 장의 남은 시간에 든다",
      () => [interval("사운드 체크", 120), songItem("a")],
      { steps: [[["사운드 체크 120"], "song", "첫 곡", 240, 360]], trailing: [] },
    ],
    [
      "곡 사이 인터벌은 다음 곡으로 넘긴 뒤에 하므로 다음 장 앞에 붙고 그 장의 남은 시간에 든다",
      () => [songItem("a"), interval("기타 셋업 변경", 180), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 683], [["기타 셋업 변경 180"], "song", "끝 곡", 263, 443]], trailing: [] },
    ],
    [
      "맨 끝 인터벌은 마지막 장 뒤에 남고 마지막 장의 남은 시간에 든다",
      () => [songItem("a"), interval("앵콜 대기", 60)],
      { steps: [[[], "song", "첫 곡", 240, 300]], trailing: ["앵콜 대기 60"] },
    ],
    [
      "이어진 인터벌은 순서대로 모두 다음 장 앞에 붙는다",
      () => [songItem("a"), interval("멘트", 60), interval(null, 180), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 743], [["멘트 60", "인터벌 180"], "song", "끝 곡", 263, 503]], trailing: [] },
    ],
    ["빈 셋리스트는 장이 없다", () => [], { steps: [], trailing: [] }],
    ["인터벌만 있으면 장이 없다", () => [interval("사운드 체크", 120)], { steps: [], trailing: ["사운드 체크 120"] }],
    [
      "지워진 곡은 장이 아니고 그 앞뒤 인터벌은 다음 장 앞에 붙는다",
      () => [songItem("a"), interval("멘트", 60), deleted(), interval("셋업", 30), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 593], [["멘트 60", "셋업 30"], "song", "끝 곡", 263, 353]], trailing: [] },
    ],
    [
      "지워진 곡이 맨 앞이면 그 뒤 인터벌은 첫 장 앞에 붙는다",
      () => [deleted(), interval("멘트", 60), songItem("a")],
      { steps: [[["멘트 60"], "song", "첫 곡", 240, 300]], trailing: [] },
    ],
    [
      "후보곡 목록에 없는 곡도 지워진 곡처럼 뺀다",
      () => [songItem("a"), songItem("gone"), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 503], [[], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "셋리스트에서 고친 제목과 시간을 쓴다",
      () => [songItem("a", { title_override: "공연용 제목", duration_override_seconds: 200 })],
      { steps: [[[], "song", "공연용 제목", 200, 200]], trailing: [] },
    ],
    [
      "시간 모르는 곡은 시간 미입력이고 남은 시간에는 0으로 든다",
      () => [songItem("b"), songItem("c")],
      { steps: [[[], "song", "시간 모르는 곡", null, 263], [[], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "저장된 순서가 아니라 position 순서다",
      () => {
        const [first, second] = [songItem("a"), songItem("c")];
        return [first, { ...second, position: 0 }];
      },
      { steps: [[[], "song", "끝 곡", 263, 503], [[], "song", "첫 곡", 240, 240]], trailing: [] },
    ],
  ] as const)("%s", (_name, items, expected) => {
    expect(summary(items())).toEqual(expected);
  });

  it("곡 장은 그 곡을, 자작곡 장은 설명을 들고 있다", () => {
    const { steps } = rehearsalSteps([songItem("a"), original("우리 노래", 225, "첫 자작곡")], songs);
    expect(steps[0]).toMatchObject({ kind: "song", song: songs[0] });
    expect(steps[1]).toMatchObject({ kind: "original", description: "첫 자작곡" });
  });

  it("같은 곡이 두 번 들면 두 장이고 장은 셋리스트 줄로 구별된다", () => {
    const items = [songItem("a"), songItem("a")];
    expect(rehearsalSteps(items, songs).steps.map((step) => step.id)).toEqual(items.map((item) => item.id));
  });

  it("합주 탭은 곡 3개와 자작곡 1개로 네 장이고 첫 장에서 셋리스트 탭과 같은 16:28 이 남는다", () => {
    expect(summary(fixtureItems)).toEqual({
      steps: [
        [["사운드 체크 120"], "song", "첫 곡", 200, FIXTURE_TOTAL_SECONDS],
        [["기타 셋업 변경 180"], "song", "시간 모르는 곡", null, 668],
        [[], "original", "우리 노래", 225, 488],
        [[], "song", "끝 곡", 263, 263],
      ],
      trailing: [],
    });
  });
});
