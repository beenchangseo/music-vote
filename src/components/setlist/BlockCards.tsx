"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Badge from "../ui/Badge";
import { effectiveSetlistDuration, effectiveSetlistTitle, formatRuntime } from "@/domain/setlist";
import { displayArtist, formatKey } from "@/domain/song-meta";
import type { SetlistItem, SongWithScore } from "@/domain/types";
import { BLOCK_TONES, type BlockKind } from "./block-tones";

interface CardShellProps {
  kind: BlockKind;
  editing: boolean;
  onRemove: () => void;
  current?: boolean;
  className?: string;
  children: ReactNode;
}

function CardShell({ kind, editing, onRemove, current = false, className = "", children }: CardShellProps) {
  const tone = BLOCK_TONES[kind];
  return (
    <div className={`flex items-center gap-3 rounded-card border ${current ? "border-primary-fg/60" : tone.border} ${tone.fill} ${className}`}>
      {editing && (
        <button type="button" onClick={onRemove} className="-mx-1 flex size-11 shrink-0 items-center justify-center text-danger-fg print:hidden" aria-label="삭제">
          <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M8 12h8" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}

function MetaLine({ name, duration, className = "" }: { name: ReactNode; duration: number | null; className?: string }) {
  return (
    <span className={`flex min-w-0 ${className}`}>
      <span className="truncate">{name}</span>
      <span className={`shrink-0 tabular-nums ${duration == null ? "text-warning" : ""}`}>{" · "}{duration == null ? "시간 없음" : formatRuntime(duration)}</span>
    </span>
  );
}

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
  const coverClass = `relative shrink-0 overflow-hidden rounded-control bg-surface-elevated ${editing ? "size-12" : "size-14"}`;
  const text = (
    <span className="min-w-0 flex-1 text-left">
      <span className={`line-clamp-2 text-body font-semibold leading-6 ${nowPlaying ? "text-primary-fg" : "text-text"}`}>{title}</span>
      <MetaLine name={displayArtist(song.artist, song.title) || "아티스트 미입력"} duration={duration} className="text-sm leading-5 text-text-muted" />
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
      <CardShell kind="song" editing onRemove={onRemove} className="p-3">
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3" aria-label="곡 블록 수정">
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
                  <span key={delay} className="h-full w-0.5 origin-bottom animate-eq-bar rounded-full bg-accent-play" style={{ animationDelay: delay }} />
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
  const body = (
    <>
      <span className={`flex shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-fg ${editing ? "size-12" : "size-14"}`}>
        <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="line-clamp-2 text-body font-semibold leading-6 text-text">{item.label || "자작곡"}</span>
        <MetaLine
          name={<span className="font-medium text-primary-fg">자작곡</span>}
          duration={item.duration_seconds > 0 ? item.duration_seconds : null}
          className="text-sm leading-5 text-text-muted"
        />
        {item.description && <span className="mt-0.5 block truncate text-caption text-text-subtle">{item.description}</span>}
      </span>
    </>
  );

  return (
    <CardShell kind="original" editing={editing} onRemove={onRemove} className="p-3">
      {editing ? (
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3" aria-label="자작곡 수정">
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
  const canExpand = !!item.description || (item.label?.length || 0) > 30;
  const open = expanded && !editing;
  const line = (
    <>
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`flex min-w-0 text-sm ${open ? "flex-wrap" : ""}`}>
        <span className={`font-semibold ${open ? "" : "truncate"}`}>{item.label || "인터벌"}</span>
        {item.duration_seconds > 0 && <span className="shrink-0 tabular-nums">{" · "}{formatRuntime(item.duration_seconds)}</span>}
      </span>
      {item.description && !open && <span className="min-w-0 truncate text-caption text-text-muted">{item.description}</span>}
      {canExpand && !editing && (
        <svg className={`ml-auto size-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </>
  );
  const lineClass = "flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left";

  return (
    <CardShell kind="interval" editing={editing} onRemove={onRemove} className={editing ? "pr-3 pl-2" : "px-3"}>
      <span className="min-w-0 flex-1">
        {editing ? (
          <button type="button" onClick={onEdit} className={lineClass} aria-label="인터벌 수정">
            {line}
          </button>
        ) : canExpand ? (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className={`${lineClass} w-full`}>
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

export function MoveButton({ direction, disabled, onClick }: { direction: "up" | "down"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
      aria-label={direction === "up" ? "위로" : "아래로"}
    >
      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={direction === "up" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    </button>
  );
}
