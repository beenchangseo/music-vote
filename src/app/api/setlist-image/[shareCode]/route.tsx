import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { formatRuntime, setlistRows, summarizeSetlist, type SetlistRow } from "@/domain/setlist";
import type { SetlistItem } from "@/domain/types";

export const runtime = "edge";

// Pretendard via CDN — 1년 edge 캐시
async function loadFont(weight: 700 | 800): Promise<ArrayBuffer> {
  const url =
    weight === 800
      ? "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-ExtraBold.otf"
      : "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf";
  const res = await fetch(url, {
    cache: "no-store",
  } as RequestInit);
  return res.arrayBuffer();
}

const C = {
  bg: "linear-gradient(180deg, #1a1025 0%, #0a0a0f 50%, #0f1a2e 100%)",
  brand: "#8b5cf6",
  brandSoft: "rgba(139, 92, 246, 0.15)",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  border: "rgba(255, 255, 255, 0.08)",
  rowBg: "rgba(255, 255, 255, 0.04)",
};

interface SetlistItemRow {
  position: number;
  item_type: SetlistItem["item_type"];
  song_id: string | null;
  label: string | null;
  description: string | null;
  duration_seconds: number;
  title_override: string | null;
  duration_override_seconds: number | null;
}
interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  duration_seconds: number | null;
  key_root: string | null;
  key_mode: string | null;
  key_memo: string | null;
  tempo_bpm: number | null;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ shareCode: string }> },
) {
  const { shareCode } = await ctx.params;

  // playlists, setlist_items and songs are closed to the public key (v18).
  // Read with service_role here; the key stays on the server.
  const admin = createAdminClient();

  // 1) playlist
  const { data: playlist } = await admin
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) {
    return new Response("Not found", { status: 404 });
  }

  // 2) setlist items
  const { data: items } = await admin
    .from("setlist_items")
    .select("position, item_type, song_id, label, description, duration_seconds, title_override, duration_override_seconds")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: true });

  const setlistItems: SetlistItemRow[] = items ?? [];

  // 3) songs (only the ones referenced in setlist)
  const songIds = setlistItems
    .filter((i) => i.item_type === "song" && i.song_id)
    .map((i) => i.song_id as string);

  let songs: SongRow[] = [];
  if (songIds.length > 0) {
    const { data: songRows } = await admin
      .from("songs")
      .select(
        "id, title, artist, duration_seconds, key_root, key_mode, key_memo, tempo_bpm",
      )
      .in("id", songIds);
    songs = songRows ?? [];
  }
  const { songCount, totalRuntime } = summarizeSetlist(setlistItems, songs);
  const rows = setlistRows(setlistItems, songs);

  // 설명이 있는 인터벌·자작곡은 더 많은 세로 공간을 배정하고, 들어가는 항목은 설명을 전부 표시한다.
  const visible: SetlistRow[] = [];
  let usedSpace = 0;
  for (const row of rows) {
    const cost = row.kind !== "song" && row.description ? 3 : 1;
    if (usedSpace + cost > 18) break;
    visible.push(row);
    usedSpace += cost;
  }
  const truncated = rows.length - visible.length;

  const [fontBold, fontExtraBold] = await Promise.all([
    loadFont(700),
    loadFont(800),
  ]);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          fontFamily: "Pretendard",
          padding: "64px 56px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 32px rgba(139, 92, 246, 0.35)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303" />
              </svg>
            </div>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.text }}>
              Plypick
            </span>
          </div>

          <div
            style={{
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 999,
              background: C.brandSoft,
              color: C.brand,
              fontSize: 24,
              fontWeight: 800,
              marginTop: 36,
            }}
          >
            🎵 셋리스트
          </div>

          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: C.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginTop: 22,
              maxWidth: "98%",
            }}
          >
            {playlist.title}
          </div>

          <div
            style={{
              display: "flex",
              gap: 28,
              marginTop: 24,
              fontSize: 28,
              color: C.textMuted,
              fontWeight: 700,
            }}
          >
            <span>총 {songCount}곡</span>
            {totalRuntime > 0 && (
              <>
                <span style={{ color: C.textSubtle }}>·</span>
                <span>{formatRuntime(totalRuntime)}</span>
              </>
            )}
          </div>
        </div>

        {/* Songs list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {visible.map((row, index) => {
            const isInterval = row.kind === "interval";
            const subtitle = row.kind === "song" ? row.artist : row.kind === "original" ? row.description || "자작곡" : null;

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 22px",
                  borderRadius: 16,
                  background: isInterval ? "transparent" : C.rowBg,
                  border: isInterval
                    ? `2px dashed ${C.border}`
                    : `1px solid ${C.border}`,
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isInterval ? "transparent" : C.brandSoft,
                    color: isInterval ? C.textSubtle : C.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {isInterval ? "⏸" : row.number}
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: isInterval ? C.textMuted : C.text,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {row.title}
                  </span>
                  {isInterval && row.description && (
                    <span style={{ fontSize: 20, color: C.textMuted, marginTop: 4, fontWeight: 700, whiteSpace: "pre-wrap" }}>
                      {row.description}
                    </span>
                  )}
                  {subtitle && (
                    <span
                      style={{
                        fontSize: 22,
                        color: C.textMuted,
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      {subtitle}
                    </span>
                  )}
                </div>

                {!isInterval && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {row.kind === "song" && row.bpm ? (
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: C.brand,
                        }}
                      >
                        {row.bpm} BPM
                      </span>
                    ) : null}
                    {row.duration != null && (
                      <span
                        style={{
                          fontSize: 20,
                          color: C.textMuted,
                          fontWeight: 700,
                        }}
                      >
                        {formatRuntime(row.duration)}
                      </span>
                    )}
                  </div>
                )}
                {isInterval && row.duration ? (
                  <span
                    style={{
                      fontSize: 22,
                      color: C.textMuted,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {formatRuntime(row.duration)}
                  </span>
                ) : null}
              </div>
            );
          })}

          {truncated > 0 && (
            <div
              style={{
                marginTop: 8,
                textAlign: "center",
                fontSize: 22,
                color: C.textSubtle,
                fontWeight: 700,
              }}
            >
              외 {truncated}개 항목 더
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 28,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 22, color: C.textSubtle, fontWeight: 700 }}>
            plypick.kr
          </span>
          <span
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: C.brand,
              color: "white",
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            밴드 곡 투표
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Pretendard", data: fontBold, style: "normal", weight: 700 },
        { name: "Pretendard", data: fontExtraBold, style: "normal", weight: 800 },
      ],
    },
  );
  if (request.nextUrl.searchParams.get("download") === "1") {
    response.headers.set("Content-Disposition", `attachment; filename="setlist-${shareCode}.png"`);
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
