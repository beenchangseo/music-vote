import { PLAYLIST_STAGE_LABEL, playlistStage, type PlaylistStage } from "./playlist-stage";
import { summarizeSetlist } from "./setlist";
import type { SetlistItem, Song } from "./types";

/**
 * 셋리스트 카드(셋리스트 링크 미리보기와 카톡 셋리스트 카드)가 말하는 셋리스트. 카드는 지금 단계를 말한다(#94).
 * 링크 미리보기, 카톡 버튼, /api/og 그림이 모두 이 모양 하나에서 글자를 만들어 서로 다른 말을 하지 않는다.
 */
export interface SetlistStatus {
  stage: PlaylistStage;
  /** 셋리스트의 곡·자작곡 수(summarizeSetlist). 후보곡 수가 아니다(#87). */
  songCount: number;
  /** 공연 길이(분). 길이를 모르는 블록이 하나라도 있으면 실제보다 짧게 말하게 되니 null 이다. */
  runtimeMinutes: number | null;
}

export interface SetlistCard {
  /** `/api/og?` 뒤에 붙는 그림 쿼리. 단계가 들어 있어 단계마다 그림 주소가 다르다. */
  imageQuery: string;
  /** 붙여 넣은 `?tab=setlist` 링크의 og:title·og:description. */
  linkTitle: string;
  linkDescription: string;
  /** 카톡 셋리스트 버튼이 보내는 feed 카드. 글자는 그림의 배지와 줄과 같다. */
  feedTitle: string;
  feedDescription: string;
}

const STAGE_MARK: Record<PlaylistStage, string> = { voting: "🎤 ", building: "🎵 ", confirmed: "🎵 ", closed: "" };

export function setlistStatus(
  setlistConfirmed: boolean,
  items: SetlistItem[],
  songs: Pick<Song, "id" | "duration_seconds">[],
): SetlistStatus {
  const { songCount, totalRuntime, missingDurationCount } = summarizeSetlist(items, songs);
  const minutes = Math.round(totalRuntime / 60);
  return {
    stage: playlistStage({ setlistConfirmed, setlistBlockCount: songCount }),
    songCount,
    runtimeMinutes: missingDurationCount === 0 && minutes > 0 ? minutes : null,
  };
}

function badge(stage: PlaylistStage): string {
  return STAGE_MARK[stage] + PLAYLIST_STAGE_LABEL[stage];
}

/** 셋리스트에 무엇이 들었는지를 단계의 말로. */
function contentLine({ stage, songCount, runtimeMinutes }: SetlistStatus): string {
  const runtime = runtimeMinutes === null ? "" : ` · ${runtimeMinutes}분`;
  switch (stage) {
    case "voting":
      return "셋리스트는 아직 비어 있어요";
    case "building":
      return `지금 ${songCount}곡${runtime}`;
    case "confirmed":
      return `총 ${songCount}곡${runtime}`;
    case "closed":
      return "셋리스트 없이 마감됐어요";
  }
}

/** 그림과 카톡 카드의 줄. 확정 카드는 #94 이전 카드처럼 "다음 공연 준비 완료"로 끝난다. */
function pictureLine(status: SetlistStatus): string {
  const line = contentLine(status);
  return status.stage === "confirmed" ? `${line} · 다음 공연 준비 완료` : line;
}

export function setlistShareCard(
  playlist: { title: string; participants: number; candidateCount: number },
  status: SetlistStatus,
): SetlistCard {
  const params = new URLSearchParams({
    variant: "setlist",
    title: playlist.title,
    stage: status.stage,
    setlistCount: String(status.songCount),
    participants: String(playlist.participants),
  });
  if (status.runtimeMinutes !== null) params.set("minutes", String(status.runtimeMinutes));
  const line = contentLine(status);
  return {
    imageQuery: params.toString(),
    linkTitle: `${playlist.title} ${PLAYLIST_STAGE_LABEL[status.stage]} - Plypick`,
    linkDescription: status.stage === "voting" ? `${line} · 후보곡 ${playlist.candidateCount}곡` : line,
    feedTitle: `${badge(status.stage)} — ${playlist.title}`,
    feedDescription: pictureLine(status),
  };
}

function isPlaylistStage(value: string | null): value is PlaylistStage {
  return Object.keys(PLAYLIST_STAGE_LABEL).some((stage) => stage === value);
}

/**
 * /api/og 셋리스트 그림의 배지와 줄. 쿼리는 누구나 고칠 수 있으니 모르는 단계는 없는 것으로 읽는다.
 * 단계가 없는 쿼리는 #94 이전에 보낸 카드거나 셋리스트를 못 읽은 화면이 보낸 카드다. 둘 다 확정 배너에서만 나가서
 * 이전처럼 확정으로 그린다.
 */
export function setlistPictureText(params: URLSearchParams): { badge: string; line: string } {
  const stage = params.get("stage");
  const songCount = Math.max(0, parseInt(params.get("setlistCount") ?? "", 10) || 0);
  if (isPlaylistStage(stage)) {
    const minutes = parseInt(params.get("minutes") ?? "", 10);
    return { badge: badge(stage), line: pictureLine({ stage, songCount, runtimeMinutes: minutes > 0 ? minutes : null }) };
  }
  // 0 은 보낸 사람이 셋리스트를 몰랐던 카드다. 후보곡 수는 셋리스트의 곡 수가 아니라 싣지 않는다(#87).
  return {
    badge: badge("confirmed"),
    line: songCount > 0 ? pictureLine({ stage: "confirmed", songCount, runtimeMinutes: null }) : "다음 공연 준비 완료",
  };
}
