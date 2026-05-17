"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";

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

export default function MyPlaylists({ loggedIn = true, dbPlaylists = [] }: MyPlaylistsProps) {
  const localPlaylists = useSyncExternalStore(subscribe, getLocalPlaylists, () => EMPTY_PLAYLISTS);

  // 병합: DB 기준 우선, shareCode 로 중복 제거, localStorage 잔여(익명 플리)도 표시
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; shareCode: string; title: string }[] = [];
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

  return (
    <div className="mt-10 w-full">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        내 플레이리스트
      </h2>
      <div className="space-y-2">
        {merged.map((pl) => (
          <Link
            key={pl.shareCode}
            href={`/playlist/${pl.shareCode}`}
            className="block w-full px-4 py-3 rounded-xl bg-surface border border-border hover:border-gray-600 transition-all text-left"
          >
            <span className="text-text font-medium">{pl.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
