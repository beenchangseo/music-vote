"use client";

// 랜딩의 "직접 눌러 보는 투표". 로그인 전에 핵심 동작(찬반 → 점수순 재정렬)을 손으로 겪게 한다.
// 서버로 아무것도 보내지 않는 예시다. 첫 상태는 서버 HTML 로 나가 검색엔진도 읽는다.
import { useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import RoundButton from "../ui/RoundButton";
import { ChevronIcon } from "@/components/ui/icons";
import { DEMO_SONGS, type DemoSong } from "./landing-demo-songs";

export type MyVote = 1 | -1;

/** Highest score first; ties keep their list order so a row only moves when it really passes another. */
export function rankDemoSongs(songs: DemoSong[], mine: Partial<Record<string, MyVote>>) {
  return songs
    .map((song, index) => {
      const myVote = mine[song.id] ?? 0;
      return { song, index, myVote, score: song.votes + myVote };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

const COVER: Record<DemoSong["cover"], { box: string; dot: string }> = {
  violet: { box: "bg-primary-tint", dot: "bg-primary -top-2 left-2.5" },
  slate: { box: "bg-surface-elevated", dot: "bg-primary-hover -bottom-3 -left-2.5" },
  night: { box: "bg-surface-hover", dot: "bg-primary-hover top-1 left-1" },
};

export default function LandingVoteDemo() {
  const [mine, setMine] = useState<Partial<Record<string, MyVote>>>({});
  const [listRef] = useAutoAnimate<HTMLOListElement>({ duration: 280, easing: "ease-in-out" });
  const ranked = rankDemoSongs(DEMO_SONGS, mine);
  const myCount = Object.values(mine).filter(Boolean).length;

  // Pressing the same direction again takes the vote back, like the real playlist.
  const vote = (id: string, dir: MyVote) =>
    setMine((prev) => ({ ...prev, [id]: prev[id] === dir ? undefined : dir }));

  return (
    <div className="rounded-card border border-border bg-surface px-3.5 pb-2 pt-3.5">
      <div className="flex items-center justify-between gap-3 px-0.5 pb-1.5">
        <p className="text-sm font-bold text-text">10월 정기 합주 · 후보곡</p>
        <p className="shrink-0 text-caption text-text-muted" aria-live="polite">
          {myCount > 0 ? `내 표 ${myCount}개 · 5명 참여` : "4명 투표 · 내 차례"}
        </p>
      </div>
      <ol ref={listRef}>
        {ranked.map(({ song, myVote, score }, rank) => (
          <li key={song.id} className="flex items-center gap-2.5 border-t border-surface-hover py-2">
            <span className="w-4 shrink-0 text-center text-sm font-bold tabular-nums text-text-muted">{rank + 1}</span>
            <span aria-hidden className={`relative size-11 shrink-0 overflow-hidden rounded-control ${COVER[song.cover].box}`}>
              <span className={`absolute size-10 rounded-pill ${COVER[song.cover].dot}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{song.title}</p>
              <p className="text-caption text-text-muted">{song.artist}</p>
            </div>
            <div className="flex shrink-0 items-center rounded-pill bg-surface-hover px-0.5">
              <VoteButton title={song.title} chosen={myVote === 1} dir="up" onClick={() => vote(song.id, 1)} />
              <span
                className={`min-w-6 text-center text-body font-bold tabular-nums ${
                  score > 0 ? "text-success" : score < 0 ? "text-danger-fg" : "text-text-muted"
                }`}
              >
                {score > 0 ? `+${score}` : score}
              </span>
              <VoteButton title={song.title} chosen={myVote === -1} dir="down" onClick={() => vote(song.id, -1)} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The playlist's own arrow: a vote look without aria-pressed, and a label that says what a press does. */
function VoteButton({
  title,
  chosen,
  dir,
  onClick,
}: {
  title: string;
  chosen: boolean;
  dir: "up" | "down";
  onClick: () => void;
}) {
  const name = dir === "up" ? "찬성" : "반대";
  return (
    <RoundButton
      tone={dir === "up" ? "upvote" : "downvote"}
      size="md"
      chosen={chosen}
      aria-label={chosen ? `${title} ${name} 취소` : `${title} ${name}`}
      onClick={onClick}
    >
      <ChevronIcon direction={dir} />
    </RoundButton>
  );
}
