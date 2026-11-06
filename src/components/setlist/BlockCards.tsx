"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Badge from "../ui/Badge";
import { touchTarget44 } from "../ui/Button";
import IconButton from "../ui/IconButton";
import { effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime, type SetlistBlock } from "@/domain/setlist";
import { displayArtist, formatKey } from "@/domain/song-meta";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import { BLOCK_TONES, PLAYING_CARD, type BlockKind } from "./block-tones";

interface CardShellProps {
  kind: BlockKind;
  editing: boolean;
  onRemove: () => void;
  current?: boolean;
  className?: string;
  children: ReactNode;
}

function CardShell({ kind, editing, onRemove, current = false, className = "", children }: CardShellProps) {
  return (
    <div className={`flex items-center gap-3 ${BLOCK_TONES[kind].radius} ${current ? PLAYING_CARD : BLOCK_TONES[kind].card} ${className}`}>
      {editing && (
        <IconButton bare tone="danger" size="sm" onClick={onRemove} className="print:hidden" aria-label="삭제">
          <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M8 12h8" />
          </svg>
        </IconButton>
      )}
      {children}
    </div>
  );
}

/** 편집 모드 제목 끝의 ✎. 글자 크기를 따르고, 줄 높이 칸 가운데에 그려 제목 줄 가운데에 선다. */
function EditMark() {
  return (
    <svg className="ml-1 inline h-lh w-[1em] align-top text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 20l1-4.5L15.6 4.9a1.9 1.9 0 012.7 0l.8.8a1.9 1.9 0 010 2.7L8.5 19 4 20z" />
    </svg>
  );
}

const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" });

/**
 * 줄이지 않은 제목의 마지막 글자와 뒤에 붙는 것(시간·✎)을 nowrap 으로 묶는다. 그림 앞은 브라우저가 늘 줄을 바꿀 수 있는
 * 자리이고, 띄어 쓰지 않은 긴 제목을 칸 끝에서 자를 때도 마찬가지라서, 묶지 않으면 ✎ 나 시간만 다음 줄로 내려간다.
 */
function GluedEnd({ text, children }: { text: string; children: ReactNode }) {
  const last = Array.from(graphemes.segment(text)).at(-1)?.segment ?? "";
  return (
    <>
      {text.slice(0, text.length - last.length)}
      <span className="whitespace-nowrap">
        {last}
        {children}
      </span>
    </>
  );
}

/** 편집 모드에서는 제목을 줄이지 않고 끝에 ✎ 를 붙인다. 줄이면 ✎ 도 같이 잘린다. */
function BlockTitle({ text, editing, className }: { text: string; editing: boolean; className: string }) {
  const style = `break-keep-wrap text-body font-semibold leading-6 ${className}`;
  if (!editing) return <span className={`line-clamp-2 ${style}`}>{text}</span>;
  return (
    <span className={`block ${style}`}>
      <GluedEnd text={text}>
        <EditMark />
      </GluedEnd>
    </span>
  );
}

function Runtime({ seconds }: { seconds: number | null }) {
  return seconds == null ? <span className="text-warning">시간 없음</span> : <>{formatRuntime(seconds)}</>;
}

const META = "text-sm leading-5 text-text-muted";

const coverBox = (editing: boolean) => `shrink-0 rounded-control bg-surface-elevated ${editing ? "size-12" : "size-14"}`;

interface BlockProps {
  item: SetlistItem;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

interface SongBlockProps extends BlockProps {
  song: SongWithScore;
  nowPlaying: boolean;
  onPlay?: () => void;
}

export function SongBlock({ item, song, editing, onEdit, onRemove, nowPlaying, onPlay }: SongBlockProps) {
  const title = effectiveSetlistTitle(item, song);
  const duration = effectiveSetlistDuration(item, song);
  const key = formatKey(song.key_root, song.key_mode) || song.key_memo;
  const thumbnail = song.thumbnail_url && <Image src={song.thumbnail_url} alt="" fill sizes="56px" className="object-cover" />;
  const coverClass = `relative overflow-hidden ${coverBox(editing)}`;
  const text = (
    <span className="min-w-0 flex-1 text-left">
      <BlockTitle text={title} editing={editing} className={nowPlaying ? "text-primary-fg" : "text-text"} />
      <span className={`flex min-w-0 ${META}`}>
        <span className="truncate">{displayArtist(song.artist, song.title) || "아티스트 미입력"}</span>
        <span className="shrink-0 tabular-nums">
          {" · "}
          <Runtime seconds={duration} />
        </span>
      </span>
      {(song.tempo_bpm || key) && (
        <span className="mt-1.5 flex items-center gap-1">
          {song.tempo_bpm ? <Badge>{song.tempo_bpm} BPM</Badge> : null}
          {key && <Badge className="max-w-18 truncate">{key}</Badge>}
        </span>
      )}
    </span>
  );

  if (editing) {
    return (
      <CardShell kind="song" editing onRemove={onRemove} current={nowPlaying} className="p-3">
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`「${title}」 제목 고치기`}>
          <span className={coverClass}>{thumbnail}</span>
          {text}
        </button>
      </CardShell>
    );
  }

  return (
    <CardShell kind="song" editing={false} onRemove={onRemove} current={nowPlaying} className="p-3">
      {onPlay ? (
        <button type="button" onClick={onPlay} className={`group ${coverClass}`} aria-label={`${title} 재생`}>
          {thumbnail}
          <span className={`absolute inset-0 flex items-center justify-center transition-colors ${nowPlaying ? "bg-black/55" : "bg-black/25 group-hover:bg-black/45"}`}>
            {nowPlaying ? (
              <span className="flex h-4 items-end gap-0.5" aria-hidden>
                {["0ms", "150ms", "300ms"].map((delay) => (
                  <span key={delay} className="h-full w-0.5 origin-bottom animate-eq-bar rounded-pill bg-accent-play" style={{ animationDelay: delay }} />
                ))}
              </span>
            ) : (
              <span className="flex size-7 items-center justify-center rounded-pill bg-black/60">
                <svg className="ml-px size-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            )}
          </span>
        </button>
      ) : (
        <span className={coverClass}>{thumbnail}</span>
      )}
      {text}
    </CardShell>
  );
}

export function OriginalBlock({ item, editing, onEdit, onRemove }: BlockProps) {
  const label = item.label || "자작곡";
  const body = (
    <>
      <span className={`flex items-center justify-center text-primary-fg ${coverBox(editing)}`}>
        <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <BlockTitle text={label} editing={editing} className="text-text" />
        <span className={`flex items-center gap-1.5 tabular-nums ${META}`}>
          <Badge tone="primary">자작곡</Badge>{" "}
          <Runtime seconds={item.duration_seconds > 0 ? item.duration_seconds : null} />
        </span>
        {item.description && <span className="mt-0.5 block truncate text-caption text-text-subtle">{item.description}</span>}
      </span>
    </>
  );

  return (
    <CardShell kind="original" editing={editing} onRemove={onRemove} className="p-3">
      {editing ? (
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`「${label}」 자작곡 고치기`}>
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
    </CardShell>
  );
}

export function IntervalBlock({ item, editing, onEdit, onRemove }: BlockProps) {
  const [expanded, setExpanded] = useState(false);
  const label = item.label || "인터벌";
  const canExpand = !!item.description || (item.label?.length || 0) > 30;
  const open = expanded && !editing;
  const time = item.duration_seconds > 0 && ` · ${formatRuntime(item.duration_seconds)}`;
  const line = (
    <>
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {open || editing ? (
        <span className="min-w-0 break-keep-wrap py-1.5 text-sm font-medium">
          <GluedEnd text={label}>
            <span className="font-normal tabular-nums">{time}</span>
            {editing && <EditMark />}
          </GluedEnd>
        </span>
      ) : (
        <span className="flex min-w-0 text-sm">
          <span className="truncate font-medium">{label}</span>
          <span className="shrink-0 tabular-nums">{time}</span>
        </span>
      )}
      {item.description && !open && <span className="min-w-0 grow basis-0 truncate text-caption text-text-subtle">{item.description}</span>}
      {canExpand && !editing && (
        <svg className={`ml-auto size-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </>
  );
  const lineClass = "flex w-full min-w-0 flex-1 items-center gap-2 text-left";

  return (
    <CardShell kind="interval" editing={editing} onRemove={onRemove} className="min-h-control-sm px-3">
      <span className="min-w-0 flex-1">
        {editing ? (
          <button type="button" onClick={onEdit} className={`${lineClass} ${touchTarget44}`} aria-label={`「${label}」 인터벌 고치기`}>
            {line}
          </button>
        ) : canExpand ? (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className={`${lineClass} ${touchTarget44}`}>
            {line}
          </button>
        ) : (
          <span className={lineClass}>{line}</span>
        )}
        {item.description && open && (
          <p className="whitespace-pre-wrap pb-2.5 pl-6 text-caption leading-relaxed text-text-muted">{item.description}</p>
        )}
      </span>
    </CardShell>
  );
}

interface BlockCardProps {
  block: SetlistBlock<SongWithScore>;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  nowPlaying?: boolean;
  onPlay?: () => void;
}

/** 블록 종류에 맞는 카드. 보기 목록·편집 목록·끄는 카드가 같이 쓴다. */
export function BlockCard({ block, editing, onEdit, onRemove, nowPlaying = false, onPlay }: BlockCardProps) {
  if (block.kind === "song") {
    return <SongBlock item={block.item} song={block.song} editing={editing} onEdit={onEdit} onRemove={onRemove} nowPlaying={nowPlaying} onPlay={onPlay} />;
  }
  if (block.kind === "original") return <OriginalBlock item={block.item} editing={editing} onEdit={onEdit} onRemove={onRemove} />;
  return <IntervalBlock item={block.item} editing={editing} onEdit={onEdit} onRemove={onRemove} />;
}
