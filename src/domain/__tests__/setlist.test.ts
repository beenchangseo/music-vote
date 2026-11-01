import { describe, expect, it } from "vitest";
import { cumulativeStarts, effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, moveSetlistBlock, parseBlockFields, rehearsalSteps, setlistBlocks, setlistBlockTitle, setlistEditAccess, setlistInsertSlots, setlistPlayOrder, setlistRows, summarizeSetlist } from "../setlist";
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

describe("setlistBlocks", () => {
  const songs = [
    { id: "a", duration_seconds: 200 },
    { id: "b", duration_seconds: 240 },
  ];
  const at = (position: number, fields: Partial<SetlistItem>) =>
    ({ ...base, id: `item-${position}`, position, song_id: null, ...fields }) as SetlistItem;
  const a = (position: number) => at(position, { song_id: "a" });
  const b = (position: number) => at(position, { song_id: "b" });
  const deleted = (position: number) => at(position, { song_id: null });
  const interval = (position: number) => at(position, { item_type: "interval", duration_seconds: 60 });
  const original = (position: number) => at(position, { item_type: "original", duration_seconds: 210 });

  it.each([
    [
      "곡·인터벌·자작곡이 모두 블록이 되고 앞 블록이 끝난 시각에 시작한다",
      [a(0), interval(1), original(2), b(3)],
      [["item-0", "song", 0], ["item-1", "interval", 200], ["item-2", "original", 260], ["item-3", "song", 470]],
    ],
    [
      "후보곡을 지워 song_id 가 빈 곡 블록은 그리지 않고 다음 블록이 이어서 시작한다",
      [a(0), deleted(1), interval(2), b(3)],
      [["item-0", "song", 0], ["item-2", "interval", 200], ["item-3", "song", 260]],
    ],
    [
      "후보곡 목록에 없는 곡을 가리키는 곡 블록도 그리지 않는다",
      [a(0), at(1, { song_id: "gone" }), b(2)],
      [["item-0", "song", 0], ["item-2", "song", 200]],
    ],
    ["맨 앞 곡이 지워지면 다음 블록이 0:00 에 시작한다", [deleted(0), b(1)], [["item-1", "song", 0]]],
    ["지워진 곡이 연달아 있어도 남은 블록이 이어진다", [a(0), deleted(1), deleted(2), b(3)], [["item-0", "song", 0], ["item-3", "song", 200]]],
    ["지워진 곡만 남으면 그릴 블록이 없다", [deleted(0)], []],
    ["저장된 순서가 아니라 position 순으로 줄을 세운다", [b(1), a(0)], [["item-0", "song", 0], ["item-1", "song", 200]]],
  ])("%s", (_name, items, expected) => {
    expect(setlistBlocks(items, songs).map((block) => [block.item.id, block.kind, block.start])).toEqual(expected);
  });

  it("곡 블록에 그 후보곡을 붙인다", () => {
    const [block] = setlistBlocks([b(0)], songs);
    expect(block.kind === "song" && block.song).toBe(songs[1]);
  });

  describe("moveSetlistBlock", () => {
    const moved = (items: SetlistItem[], activeId: string, overId: string) =>
      moveSetlistBlock(items, setlistBlocks(items, songs), activeId, overId)?.map((item) => [item.id, item.position]);

    it.each([
      ["위 블록 자리에 놓으면 둘이 자리를 바꾼다", [a(0), interval(1), b(2)], "item-2", "item-1", [["item-0", 0], ["item-2", 1], ["item-1", 2]]],
      ["여러 칸을 건너 옮긴다", [a(0), interval(1), b(2)], "item-0", "item-2", [["item-1", 0], ["item-2", 1], ["item-0", 2]]],
      [
        "그린 블록끼리만 자리를 바꾸고 지워진 곡 블록은 제자리에 둔다",
        [deleted(0), a(1), deleted(2), b(3)],
        "item-3",
        "item-1",
        [["item-0", 0], ["item-3", 1], ["item-2", 2], ["item-1", 3]],
      ],
      [
        "다른 멤버가 막 넣어 아직 후보곡 목록에 없는 곡 블록은 끝으로 밀리지 않는다",
        [a(0), at(1, { song_id: "fresh" }), interval(2), b(3)],
        "item-2",
        "item-0",
        [["item-2", 0], ["item-1", 1], ["item-0", 2], ["item-3", 3]],
      ],
      [
        "숨은 블록 바로 뒤로 내려도 숨은 블록은 움직이지 않는다",
        [a(0), at(1, { song_id: "fresh" }), b(2)],
        "item-0",
        "item-2",
        [["item-2", 0], ["item-1", 1], ["item-0", 2]],
      ],
      [
        "position 에 빈자리가 있어도 순서대로 0부터 다시 매긴다",
        [at(4, { song_id: "a" }), at(9, { song_id: "fresh" }), at(7, { song_id: "b" })],
        "item-7",
        "item-4",
        [["item-7", 0], ["item-4", 1], ["item-9", 2]],
      ],
    ])("%s", (_name, items, activeId, overId, expected) => {
      expect(moved(items, activeId, overId)).toEqual(expected);
    });

    it.each([
      ["제자리에 놓으면", [a(0), b(1)], "item-0", "item-0"],
      ["끄는 사이 다른 멤버가 끈 블록을 지웠으면", [a(0), b(1)], "item-9", "item-1"],
      ["놓을 블록이 그 사이 사라졌으면", [a(0), b(1)], "item-0", "item-9"],
      ["놓을 자리가 숨은 블록이면", [a(0), at(1, { song_id: "fresh" }), b(2)], "item-0", "item-1"],
    ])("%s 아무것도 바꾸지 않는다", (_name, items, activeId, overId) => {
      expect(moveSetlistBlock(items, setlistBlocks(items, songs), activeId, overId)).toBeNull();
    });

    it("숨은 블록까지 모든 항목을 한 번씩 돌려준다", () => {
      const items = [deleted(0), a(1), at(2, { song_id: "fresh" }), interval(3), b(4)];
      const ids = moveSetlistBlock(items, setlistBlocks(items, songs), "item-4", "item-1")!.map((item) => item.id);
      expect([...ids].sort()).toEqual(items.map((item) => item.id).sort());
    });
  });

  describe("setlistInsertSlots", () => {
    const slots = (items: SetlistItem[]) =>
      setlistInsertSlots(setlistBlocks(items, songs), 999).map(({ slot, after, start }) => [slot.before, after?.item.id ?? null, start]);

    it.each([
      [
        "블록마다 그 위에 하나, 맨 끝에 하나를 둔다",
        [a(0), interval(1), b(2)],
        [["item-0", null, 0], ["item-1", "item-0", 200], ["item-2", "item-1", 260], [null, "item-2", 999]],
      ],
      [
        "맨 앞 (+) 는 숨은 블록이 아니라 첫 그린 블록 앞이다",
        [deleted(0), a(1)],
        [["item-1", null, 0], [null, "item-1", 999]],
      ],
      [
        "그린 블록 사이에 숨은 블록이 있어도 아래 블록 앞에 넣고 위 블록을 보여 준다",
        [a(0), at(1, { song_id: "fresh" }), b(2)],
        [["item-0", null, 0], ["item-2", "item-0", 200], [null, "item-2", 999]],
      ],
      ["그린 블록이 없으면 맨 끝 하나뿐이다", [deleted(0)], [[null, null, 999]]],
    ])("%s", (_name, items, expected) => {
      expect(slots(items)).toEqual(expected);
    });
  });

  it.each([
    ["곡은 셋리스트에서 고친 제목", setlistBlocks([at(0, { song_id: "a", title_override: "공연용" })], [{ ...songs[0], title: "원곡" }]), "공연용"],
    ["곡은 고친 제목이 없으면 후보곡 제목", setlistBlocks([a(0)], [{ ...songs[0], title: "원곡" }]), "원곡"],
    ["인터벌은 이름", setlistBlocks([at(0, { item_type: "interval", label: "멘트" })], []), "멘트"],
    ["이름 없는 인터벌", setlistBlocks([at(0, { item_type: "interval", label: null })], []), "인터벌"],
    ["이름 없는 자작곡", setlistBlocks([at(0, { item_type: "original", label: "" })], []), "자작곡"],
  ])("setlistBlockTitle: %s", (_name, [block], expected) => {
    expect(setlistBlockTitle(block)).toBe(expected);
  });
});

describe("parseBlockFields", () => {
  const fields = (overrides: Partial<{ label: string; description: string; durationSeconds: number }> = {}) => ({
    label: "기타 셋업 변경",
    description: "",
    durationSeconds: 60,
    ...overrides,
  });

  it("앞뒤 공백을 지우고 빈 설명은 없음으로 둔다", () => {
    expect(parseBlockFields("interval", fields({ label: "  멘트 ", description: "  " }))).toEqual({ label: "멘트", description: null, durationSeconds: 60 });
  });

  it.each([
    ["인터벌 이름 50자", "interval", fields({ label: "가".repeat(50) }), true],
    ["인터벌 이름 51자", "interval", fields({ label: "가".repeat(51) }), false],
    ["자작곡 이름 100자", "original", fields({ label: "가".repeat(100) }), true],
    ["자작곡 이름 101자", "original", fields({ label: "가".repeat(101) }), false],
    ["빈 이름", "interval", fields({ label: "   " }), false],
    ["설명 200자", "original", fields({ description: "가".repeat(200) }), true],
    ["설명 201자", "original", fields({ description: "가".repeat(201) }), false],
    ["시간 0초", "interval", fields({ durationSeconds: 0 }), true],
    ["음수 시간", "interval", fields({ durationSeconds: -1 }), false],
    ["소수 시간", "original", fields({ durationSeconds: 1.5 }), false],
  ] as const)("%s", (_name, kind, input, ok) => {
    expect(parseBlockFields(kind, input) !== null).toBe(ok);
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
      "맨 앞 인터벌은 장이 아니고 첫 장 앞에 붙는다. 첫 장이 지금이면 이미 지났으므로 남은 시간에 들지 않는다",
      () => [interval("사운드 체크", 120), songItem("a")],
      { steps: [[["사운드 체크 120"], "song", "첫 곡", 240, 240]], trailing: [] },
    ],
    [
      "곡 사이 인터벌은 다음 장 앞에 붙고, 다음으로 넘기면 지난 것이라 그 장의 남은 시간에 들지 않는다",
      () => [songItem("a"), interval("기타 셋업 변경", 180), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 683], [["기타 셋업 변경 180"], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "맨 끝 인터벌은 마지막 장 뒤에 남고 마지막 장의 남은 시간에 든다",
      () => [songItem("a"), interval("앵콜 대기", 60)],
      { steps: [[[], "song", "첫 곡", 240, 300]], trailing: ["앵콜 대기 60"] },
    ],
    [
      "이어진 인터벌은 순서대로 모두 다음 장 앞에 붙고 다음으로 넘기면 모두 지난다",
      () => [songItem("a"), interval("멘트", 60), interval(null, 180), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 743], [["멘트 60", "인터벌 180"], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    ["빈 셋리스트는 장이 없다", () => [], { steps: [], trailing: [] }],
    ["인터벌만 있으면 장이 없다", () => [interval("사운드 체크", 120)], { steps: [], trailing: ["사운드 체크 120"] }],
    [
      "지워진 곡은 장이 아니고 그 앞뒤 인터벌은 다음 장 앞에 붙는다",
      () => [songItem("a"), interval("멘트", 60), deleted(), interval("셋업", 30), songItem("c")],
      { steps: [[[], "song", "첫 곡", 240, 593], [["멘트 60", "셋업 30"], "song", "끝 곡", 263, 263]], trailing: [] },
    ],
    [
      "지워진 곡이 맨 앞이면 그 뒤 인터벌은 첫 장 앞에 붙는다",
      () => [deleted(), interval("멘트", 60), songItem("a")],
      { steps: [[["멘트 60"], "song", "첫 곡", 240, 240]], trailing: [] },
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

  it("셋리스트 탭이 그리는 블록을 같은 순서로 모두 지나고 셋리스트 탭이 빼는 블록은 같이 뺀다", () => {
    const lists = [
      fixtureItems,
      [songItem("a"), songItem("gone"), interval("멘트", 60), deleted(), original("우리 노래", 225), songItem("c")],
      [{ ...songItem("c"), position: 99 }, interval("셋업", 30), songItem("a")],
    ];
    for (const items of lists) {
      const { steps, trailing } = rehearsalSteps(items, songs);
      const walked = [...steps.flatMap((step) => [...step.before.map((iv) => iv.id), step.id]), ...trailing.map((iv) => iv.id)];
      expect(walked).toEqual(setlistBlocks(items, songs).map((block) => block.item.id));
    }
  });

  it("같은 곡이 두 번 들면 두 장이고 장은 셋리스트 줄로 구별된다", () => {
    const items = [songItem("a"), songItem("a")];
    expect(rehearsalSteps(items, songs).steps.map((step) => step.id)).toEqual(items.map((item) => item.id));
  });

  it("합주 탭은 곡 3개와 자작곡 1개로 네 장이고 남은 시간은 셋리스트 탭의 16:28 에서 그 장이 시작하는 시각을 뺀 값이다", () => {
    expect(summary(fixtureItems)).toEqual({
      steps: [
        [["사운드 체크 120"], "song", "첫 곡", 200, FIXTURE_TOTAL_SECONDS - 120],
        [["기타 셋업 변경 180"], "song", "시간 모르는 곡", null, 488],
        [[], "original", "우리 노래", 225, 488],
        [[], "song", "끝 곡", 263, 263],
      ],
      trailing: [],
    });
  });
});
