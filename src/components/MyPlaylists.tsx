"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import GuitarIcon from "./GuitarIcon";
import { RoomCover } from "./BandArt";

interface SavedPlaylist {
  id: string;
  shareCode: string;
  adminToken: string;
  title: string;
}

interface DbPlaylist {
  id: string;
  shareCode: string;
  title: string;
  /** 내 밴드의 방이면 그 밴드 이름 (작은 캡션, 디자인 리뷰 4A). */
  teamName?: string | null;
  /** 타일 커버 썸네일. 이 기기에만 저장된 옛 방은 없다. */
  coverThumbs?: string[];
}

const EMPTY_PLAYLISTS: SavedPlaylist[] = [];
let cachedPlaylists: SavedPlaylist[] = EMPTY_PLAYLISTS;
let cachedRaw: string | null = null;

function getLocalPlaylists(): SavedPlaylist[] {
  if (typeof window === "undefined") return EMPTY_PLAYLISTS;
  const raw = localStorage.getItem("myPlaylists");
  if (raw === cachedRaw) return cachedPlaylists;
  cachedRaw = raw;
  try {
    cachedPlaylists = raw ? JSON.parse(raw) : EMPTY_PLAYLISTS;
  } catch {
    cachedPlaylists = EMPTY_PLAYLISTS;
  }
  return cachedPlaylists;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

interface MyPlaylistsProps {
  loggedIn?: boolean;
  /** 로그인 사용자의 DB 기준 플리. 다른 기기에서 만든 것도 보임. */
  dbPlaylists?: DbPlaylist[];
}

/** 2열 타일 3줄 (Spotify 홈의 최근 항목 격자). */
const COLLAPSED_COUNT = 6;

export default function MyPlaylists({ loggedIn = true, dbPlaylists = [] }: MyPlaylistsProps) {
  const localPlaylists = useSyncExternalStore(subscribe, getLocalPlaylists, () => EMPTY_PLAYLISTS);
  const [expanded, setExpanded] = useState(false);

  // 병합: DB 기준 우선, shareCode 로 중복 제거, localStorage 잔여(익명 플리)도 표시
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: DbPlaylist[] = [];
    for (const p of dbPlaylists) {
      if (seen.has(p.shareCode)) continue;
      seen.add(p.shareCode);
      out.push(p);
    }
    for (const p of localPlaylists) {
      if (seen.has(p.shareCode)) continue;
      seen.add(p.shareCode);
      out.push({ id: p.id, shareCode: p.shareCode, title: p.title });
    }
    return out;
  }, [dbPlaylists, localPlaylists]);

  if (!loggedIn) return null;
  if (merged.length === 0) return null;

  const visible = expanded ? merged : merged.slice(0, COLLAPSED_COUNT);
  const hiddenCount = merged.length - COLLAPSED_COUNT;

  return (
    <section aria-labelledby="my-playlists" className="mt-10 w-full">
      <h2 id="my-playlists" className="mb-3 text-h3 font-bold text-text">
        내 플레이리스트
      </h2>
      {/* Spotify home recents: two columns, cover flush left, title beside it. */}
      <div className="grid grid-cols-2 gap-2">
        {visible.map((pl) => (
          <Link
            key={pl.shareCode}
            href={`/playlist/${pl.shareCode}`}
            // Playlist pages render per request, so a prefetch only brings a ~236-byte shell. With six tiles it
            // cost 12 server calls per home view and piled onto cold starts (2~8s in the network tab, 2026-10-06).
            prefetch={false}
            className="flex h-16 min-w-0 items-center gap-2.5 overflow-hidden rounded-control bg-surface pr-2 transition-colors hover:bg-surface-hover"
          >
            <RoomCover thumbs={pl.coverThumbs ?? []} sizes="64px" square className="h-16 w-16 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-keep text-sm font-semibold leading-snug text-text">{pl.title}</span>
              {pl.teamName && (
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-text-muted">
                  <GuitarIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{pl.teamName}</span>
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-hover"
        >
          전체 보기 ({merged.length}개)
        </button>
      )}
    </section>
  );
}
