"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

interface SavedPlaylist {
  id: string;
  shareCode: string;
  adminToken: string;
  title: string;
}

const EMPTY_PLAYLISTS: SavedPlaylist[] = [];
let cachedPlaylists: SavedPlaylist[] = EMPTY_PLAYLISTS;
let cachedRaw: string | null = null;

function getPlaylists(): SavedPlaylist[] {
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

export default function MyPlaylists() {
  const playlists = useSyncExternalStore(subscribe, getPlaylists, () => EMPTY_PLAYLISTS);

  if (playlists.length === 0) return null;

  return (
    <div className="mt-10 w-full">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        내 플레이리스트
      </h2>
      <div className="space-y-2">
        {playlists.map((pl) => (
          <Link
            key={pl.id}
            href={`/playlist/${pl.shareCode}`}
            className="block w-full px-4 py-3 rounded-xl bg-surface border border-border hover:border-gray-600 transition-all text-left"
          >
            <span className="text-gray-100 font-medium">{pl.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
