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
          <Choice tone="text-text-muted" icon={<ClockIcon />} title="인터벌" description="셋업 변경·멘트 시간 · 기본 1:00" onClick={() => goTo("interval")} />
          <Choice tone="text-primary-fg" icon={<NoteIcon />} title="자작곡" description="우리 곡 한 블록 · 기본 3:00" onClick={() => goTo("original")} />
          <Choice
            tone="text-text"
            icon={<ListIcon />}
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
                        <PlusIcon />
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
        <svg className="size-4 text-text-subtle" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      }
    >
      <span className="block text-body font-semibold text-text">{title}</span>
      <span className="block text-caption text-text-muted">{description}</span>
    </ListRowButton>
  );
}

function ClockIcon() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 8v8M8 12h8" />
    </svg>
  );
}
