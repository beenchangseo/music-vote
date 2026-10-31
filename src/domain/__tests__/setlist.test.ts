import { describe, expect, it } from "vitest";
import { cumulativeStarts, effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, moveSetlistBlock, setlistBlocks, setlistEditAccess, setlistPlayOrder, setlistRows, summarizeSetlist } from "../setlist";
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
    const moved = (items: SetlistItem[], from: number, to: number) =>
      moveSetlistBlock(items, setlistBlocks(items, songs), from, to).map((item) => [item.id, item.position]);

    it.each([
      ["위 블록과 자리를 바꾼다", [a(0), interval(1), b(2)], 2, 1, [["item-0", 0], ["item-2", 1], ["item-1", 2]]],
      ["여러 칸을 건너 옮긴다", [a(0), interval(1), b(2)], 0, 2, [["item-1", 0], ["item-2", 1], ["item-0", 2]]],
      [
        "그린 블록끼리만 자리를 바꾸고 지워진 곡 블록은 제자리에 둔다",
        [deleted(0), a(1), deleted(2), b(3)],
        1,
        0,
        [["item-0", 0], ["item-3", 1], ["item-2", 2], ["item-1", 3]],
      ],
      [
        "다른 멤버가 막 넣어 아직 후보곡 목록에 없는 곡 블록은 끝으로 밀리지 않는다",
        [a(0), at(1, { song_id: "fresh" }), interval(2), b(3)],
        1,
        0,
        [["item-2", 0], ["item-1", 1], ["item-0", 2], ["item-3", 3]],
      ],
      [
        "숨은 블록 바로 뒤로 내려도 숨은 블록은 움직이지 않는다",
        [a(0), at(1, { song_id: "fresh" }), b(2)],
        0,
        1,
        [["item-2", 0], ["item-1", 1], ["item-0", 2]],
      ],
      [
        "position 에 빈자리가 있어도 순서대로 0부터 다시 매긴다",
        [at(4, { song_id: "a" }), at(9, { song_id: "fresh" }), at(7, { song_id: "b" })],
        1,
        0,
        [["item-7", 0], ["item-4", 1], ["item-9", 2]],
      ],
    ])("%s", (_name, items, from, to, expected) => {
      expect(moved(items, from, to)).toEqual(expected);
    });

    it("숨은 블록까지 모든 항목을 한 번씩 돌려준다", () => {
      const items = [deleted(0), a(1), at(2, { song_id: "fresh" }), interval(3), b(4)];
      const ids = moveSetlistBlock(items, setlistBlocks(items, songs), 2, 0).map((item) => item.id);
      expect([...ids].sort()).toEqual(items.map((item) => item.id).sort());
    });
  });
});
