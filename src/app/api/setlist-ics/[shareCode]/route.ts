import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

// ICS 파일을 동적으로 생성. 쿼리 파라미터:
//   start   : "2026-05-12T19:00" (local, no TZ — floating)
//   duration: 분 단위 (예: 90). 미지정 시 셋리스트 러닝타임 + 30분 마진
//   location: "홍대 그라운드 합주실 A"
//   title   : 이벤트 제목 (기본: "{playlist title} — 합주")

interface SetlistItemRow {
  position: number;
  item_type: "song" | "interval";
  song_id: string | null;
  label: string | null;
  duration_seconds: number;
}
interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  duration_seconds: number | null;
}

function fmtIcsLocal(date: Date): string {
  // floating local time: YYYYMMDDTHHMMSS (no Z)
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function fmtIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(s: string): string {
  // RFC 5545 § 3.3.11 텍스트 이스케이프
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  // RFC 5545 § 3.1 — 75 octet 제한, 줄 wrap 시 CRLF + 한 칸 들여쓰기
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunkSize = i === 0 ? 75 : 74;
    chunks.push(line.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks.join("\r\n ");
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ shareCode: string }> },
) {
  const { shareCode } = await ctx.params;
  const { searchParams } = req.nextUrl;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // 1) playlist
  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();

  if (!playlist) return new Response("Not found", { status: 404 });

  // 2) setlist items
  const { data: items } = await supabase
    .from("setlist_items")
    .select("position, item_type, song_id, label, duration_seconds")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: true });

  const setlistItems: SetlistItemRow[] = items ?? [];

  // 3) songs (referenced only)
  const songIds = setlistItems
    .filter((i) => i.item_type === "song" && i.song_id)
    .map((i) => i.song_id as string);

  let songs: SongRow[] = [];
  if (songIds.length > 0) {
    const { data: songRows } = await supabase
      .from("songs")
      .select("id, title, artist, duration_seconds")
      .in("id", songIds);
    songs = songRows ?? [];
  }
  const songMap = Object.fromEntries(songs.map((s) => [s.id, s]));

  // 4) 시작 시간 + duration
  const startParam = searchParams.get("start");
  const durationParam = searchParams.get("duration"); // minutes
  const location = searchParams.get("location") || "";
  const overrideTitle = searchParams.get("title");

  let start: Date;
  if (startParam) {
    start = new Date(startParam);
    if (Number.isNaN(start.getTime())) {
      // 잘못된 입력 → 내일 저녁 7시로 fallback
      start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(19, 0, 0, 0);
    }
  } else {
    // 기본: 내일 저녁 7시
    start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(19, 0, 0, 0);
  }

  // 러닝타임 계산
  let totalSeconds = 0;
  for (const it of setlistItems) {
    if (it.item_type === "song" && it.song_id) {
      const s = songMap[it.song_id];
      if (s?.duration_seconds) totalSeconds += s.duration_seconds;
    } else if (it.item_type === "interval") {
      totalSeconds += it.duration_seconds || 0;
    }
  }

  const durationMinutes = durationParam
    ? Math.max(15, Math.min(600, parseInt(durationParam, 10) || 0))
    : Math.max(60, Math.ceil(totalSeconds / 60) + 30); // 러닝타임 + 30분 마진, 최소 60분

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  // 5) 설명에 셋리스트 본문
  const descriptionLines: string[] = [];
  let songNo = 1;
  for (const it of setlistItems) {
    if (it.item_type === "interval") {
      descriptionLines.push(
        `※ ${it.label || "인터벌"}${
          it.duration_seconds > 0
            ? ` (${Math.floor(it.duration_seconds / 60)}:${String(
                it.duration_seconds % 60,
              ).padStart(2, "0")})`
            : ""
        }`,
      );
      continue;
    }
    const s = it.song_id ? songMap[it.song_id] : null;
    if (!s) continue;
    const artistPart = s.artist ? ` - ${s.artist}` : "";
    descriptionLines.push(`${songNo}. ${s.title}${artistPart}`);
    songNo++;
  }
  descriptionLines.push("");
  descriptionLines.push(
    `Plypick: https://plypick.kr/playlist/${shareCode}`,
  );
  const description = descriptionLines.join("\n");

  const title = overrideTitle?.trim() || `${playlist.title} — 합주`;

  // 6) ICS 빌드
  const now = new Date();
  const uid = `plypick-${shareCode}-${start.getTime()}@plypick.kr`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plypick//Setlist//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtIcsUtc(now)}`,
    `DTSTART:${fmtIcsLocal(start)}`,
    `DTEND:${fmtIcsLocal(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : "",
    `URL:https://plypick.kr/playlist/${shareCode}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .map(foldIcsLine)
    .join("\r\n");

  const filename = `plypick-${shareCode}.ics`;

  return new Response(lines + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
