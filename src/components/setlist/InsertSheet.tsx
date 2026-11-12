"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import { ListRowButton, ListRowIcon, SongRow } from "../ui/ListRow";
import Modal from "../ui/Modal";
import BlockForm from "./BlockForm";
import { formatRuntime, setlistBlockTitle, type NewSetlistBlock } from "@/domain/setlist";
import { displayArtist, displayTitle } from "@/domain/song-meta";
import type { SongWithScore } from "@/domain/types";
import type { InsertTarget } from "./SetlistEditList";
import { ChevronIcon, ClockIcon, ListIcon, PlusIcon, SongIcon } from "@/components/ui/icons";

export type InsertStep = "choose" | "interval" | "original" | "song";

interface Props {
  target: InsertTarget;
  initialStep?: InsertStep;
  /** 셋리에 아직 없는 후보곡, 점수 순. */
  candidates: SongWithScore[];
  /** 넣으면 null, 못 넣으면 화면 문구. */
  onInsert: (block: NewSetlistBlock) => Promise<string | null>;
  onClose: () => void;
}

/** (+) 로 여는 "여기에 넣기" 시트. 인터벌·자작곡은 입력 칸으로, 후보곡은 고르면 바로 그 자리에 넣는다. */
export default function InsertSheet({ target, initialStep = "choose", candidates, onInsert, onClose }: Props) {
  const [step, setStep] = useState<InsertStep>(initialStep);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const where = `${target.after ? `「${setlistBlockTitle(target.after)}」 다음` : "맨 앞"} · ${formatRuntime(target.start)} 에 시작`;

  async function insert(block: NewSetlistBlock) {
    setPending(block.kind === "song" ? block.songId : block.kind);
    setError(null);
    const failure = await onInsert(block);
    setPending(null);
    setError(failure);
  }

  function goTo(next: InsertStep) {
    setError(null);
    setStep(next);
  }

  return (
    <Modal open onClose={onClose} title="여기에 넣기" description={where}>
      {step === "choose" && (
        <div className="flex flex-col">
          <Choice tone="text-text-muted" icon={<ClockIcon className="size-5" />} title="인터벌" description="셋업 변경·멘트 시간 · 기본 1:00" onClick={() => goTo("interval")} />
          <Choice tone="text-primary-fg" icon={<SongIcon className="size-5" />} title="자작곡" description="우리 곡 한 블록 · 기본 3:00" onClick={() => goTo("original")} />
          <Choice
            tone="text-text"
            icon={<ListIcon className="size-5" />}
            title="후보곡에서 고르기"
            description={candidates.length > 0 ? `셋리에 아직 없는 후보곡 ${candidates.length}곡` : "후보곡이 모두 셋리에 있어요"}
            disabled={candidates.length === 0}
            onClick={() => goTo("song")}
          />
        </div>
      )}

      {(step === "interval" || step === "original") && (
        <BlockForm key={step} kind={step} pending={pending !== null} error={error} onSubmit={insert} onBack={() => goTo("choose")} />
      )}

      {step === "song" && (
        <div>
          <ul>
            {candidates.map((song) => (
              <li key={song.id}>
                <SongRow
                  cover={song.thumbnail_url && <Image src={song.thumbnail_url} alt="" fill sizes="48px" className="object-cover" />}
                  trailing={
                    <IconButton bare aria-label={`${displayTitle(song.title)} 넣기`} disabled={pending !== null} onClick={() => insert({ kind: "song", songId: song.id })}>
                      {pending === song.id ? (
                        <span aria-hidden className="size-4 animate-spin rounded-pill border-2 border-border-strong border-t-primary-fg" />
                      ) : (
                        <PlusIcon circled />
                      )}
                    </IconButton>
                  }
                >
                  <span className="block truncate text-body font-semibold text-text">{displayTitle(song.title)}</span>
                  <span className="block truncate text-caption text-text-muted">
                    {displayArtist(song.artist, song.title) || "아티스트 미입력"}
                    {song.duration_seconds ? <span className="tabular-nums"> · {formatRuntime(song.duration_seconds)}</span> : null}
                  </span>
                </SongRow>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger-fg">
              {error}
            </p>
          )}
          <Button variant="tonal" fullWidth className="mt-3" onClick={() => goTo("choose")}>
            뒤로
          </Button>
        </div>
      )}
    </Modal>
  );
}

function Choice({ tone, icon, title, description, disabled = false, onClick }: { tone: string; icon: ReactNode; title: string; description: string; disabled?: boolean; onClick: () => void }) {
  return (
    <ListRowButton
      onClick={onClick}
      disabled={disabled}
      leading={<ListRowIcon className={tone}>{icon}</ListRowIcon>}
      trailing={
        <ChevronIcon direction="right" className="size-4 text-text-subtle" />
      }
    >
      <span className="block text-body font-semibold text-text">{title}</span>
      <span className="block text-caption text-text-muted">{description}</span>
    </ListRowButton>
  );
}
