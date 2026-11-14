// What the 플레이리스트 tab of the band tab bar opens (#110): one band playlist, or a picker of them all.

import { playlistStage, type PlaylistStage } from "./playlist-stage";
import { compareTimestamps } from "./timestamp";

/** A band playlist as the picker draws it. No account id: members and the band home both get it (docs/adr/0011). */
export interface PlaylistPick {
  shareCode: string;
  title: string;
  stage: PlaylistStage;
  createdAt: string;
}

const RUNNING: ReadonlySet<PlaylistStage> = new Set(["voting", "building"]);

const isRunning = (pick: PlaylistPick) => RUNNING.has(pick.stage);

/** A band home room or a playlists row, read the way the band home cards read its stage. */
export function playlistPick(playlist: {
  shareCode: string;
  title: string;
  createdAt: string;
  setlistConfirmed: boolean;
  setlistBlockCount: number;
}): PlaylistPick {
  return {
    shareCode: playlist.shareCode,
    title: playlist.title,
    createdAt: playlist.createdAt,
    stage: playlistStage(playlist),
  };
}

/** 진행 중(투표 중 · 셋리스트 짜는 중)이 먼저, 그다음 나머지. 묶음마다 최근에 만든 것부터. */
export function orderPlaylistPicks(picks: readonly PlaylistPick[]): PlaylistPick[] {
  return [...picks].sort((a, b) => Number(isRunning(b)) - Number(isRunning(a)) || compareTimestamps(b.createdAt, a.createdAt));
}

export type PlaylistTabTarget = { kind: "open"; shareCode: string } | { kind: "pick" };

/**
 * 밴드 홈에서 플레이리스트 탭이 가는 곳. 진행 중인 플레이리스트가 꼭 하나면 고를 것이 없어서 바로 연다.
 * 둘 이상이거나 없으면 고르는 시트다. 끝난 플레이리스트만 있는 밴드도 어느 것을 열지 모르므로 시트다.
 */
export function playlistTabTarget(picks: readonly PlaylistPick[]): PlaylistTabTarget {
  const running = picks.filter(isRunning);
  return running.length === 1 ? { kind: "open", shareCode: running[0].shareCode } : { kind: "pick" };
}
