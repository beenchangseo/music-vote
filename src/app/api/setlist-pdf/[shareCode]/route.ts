import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ItemRow {
  position: number;
  item_type: "song" | "interval";
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
}

const REGULAR_FONT = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf";
const BOLD_FONT = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf";

async function fetchFont(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("PDF 글꼴을 불러오지 못했습니다.");
  return Buffer.from(await response.arrayBuffer());
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function safeFilename(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 80);
  return cleaned || "셋리스트";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareCode: string }> },
) {
  const { shareCode } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("id, title")
    .eq("share_code", shareCode)
    .single();
  if (playlistError || !playlist) return new Response("Not found", { status: 404 });

  const { data: itemRows, error: itemError } = await supabase
    .from("setlist_items")
    .select("position, item_type, song_id, label, description, duration_seconds, title_override, duration_override_seconds")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: true });
  if (itemError) return new Response("셋리스트를 불러오지 못했습니다.", { status: 500 });
  const items = (itemRows || []) as ItemRow[];

  const songIds = items.flatMap((item) => item.item_type === "song" && item.song_id ? [item.song_id] : []);
  let songs: SongRow[] = [];
  if (songIds.length > 0) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, artist, duration_seconds")
      .in("id", songIds);
    if (error) return new Response("곡 정보를 불러오지 못했습니다.", { status: 500 });
    songs = (data || []) as SongRow[];
  }
  const songMap = new Map(songs.map((song) => [song.id, song]));

  const [regularFont, boldFont] = await Promise.all([fetchFont(REGULAR_FONT), fetchFont(BOLD_FONT)]);
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: `${playlist.title} 셋리스트`, Author: "Plypick" } });
  doc.registerFont("Pretendard", regularFont);
  doc.registerFont("PretendardBold", boldFont);

  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let totalSeconds = 0;
  let missing = 0;
  let songCount = 0;
  for (const item of items) {
    if (item.item_type === "interval") {
      totalSeconds += Math.max(0, item.duration_seconds || 0);
      continue;
    }
    if (!item.song_id) continue;
    const song = songMap.get(item.song_id);
    if (!song) continue;
    songCount += 1;
    const duration = item.duration_override_seconds ?? song.duration_seconds;
    if (duration == null) missing += 1;
    else totalSeconds += Math.max(0, duration);
  }

  doc.font("PretendardBold").fontSize(11).fillColor("#7c3aed").text("PLYPICK · 셋리스트");
  doc.moveDown(0.7).fontSize(23).fillColor("#111827").text(playlist.title);
  doc.moveDown(0.45).font("Pretendard").fontSize(10).fillColor("#6b7280").text(
    `${songCount}곡 · ${formatTime(totalSeconds)}${missing > 0 ? ` · ${missing}곡 시간 미입력` : ""}`,
  );
  doc.moveDown(1.3);

  const contentWidth = doc.page.width - 96;
  items.forEach((item, index) => {
    const isInterval = item.item_type === "interval";
    const song = item.song_id ? songMap.get(item.song_id) : null;
    if (!isInterval && !song) return;
    const title = isInterval ? item.label || "인터벌" : item.title_override || song!.title;
    const description = isInterval ? item.description : null;
    const duration = isInterval ? item.duration_seconds : item.duration_override_seconds ?? song!.duration_seconds;
    const subtitle = isInterval
      ? description || ""
      : `${song!.artist || "아티스트 미입력"}${duration != null ? ` · ${formatTime(duration)}` : " · 시간 미입력"}`;
    const subtitleHeight = subtitle ? doc.font("Pretendard").fontSize(9).heightOfString(subtitle, { width: contentWidth - 74 }) : 0;
    const rowHeight = Math.max(52, 31 + subtitleHeight);

    if (doc.y + rowHeight > doc.page.height - 64) doc.addPage();
    const y = doc.y;
    doc.roundedRect(48, y, contentWidth, rowHeight, 8)
      .fillAndStroke(isInterval ? "#fffbeb" : "#f9fafb", isInterval ? "#fde68a" : "#e5e7eb");
    doc.font("PretendardBold").fontSize(9).fillColor(isInterval ? "#a16207" : "#7c3aed").text(String(index + 1), 60, y + 18, { width: 24, align: "center" });
    doc.font("PretendardBold").fontSize(11).fillColor(isInterval ? "#854d0e" : "#111827").text(title, 96, y + 10, { width: contentWidth - 160, lineBreak: false, ellipsis: true });
    if (subtitle) doc.font("Pretendard").fontSize(9).fillColor(isInterval ? "#a16207" : "#6b7280").text(subtitle, 96, y + 29, { width: contentWidth - 160, lineGap: 2 });
    if (duration != null) doc.font("PretendardBold").fontSize(9).fillColor("#6b7280").text(formatTime(duration), doc.page.width - 106, y + 18, { width: 46, align: "right" });
    doc.y = y + rowHeight + 7;
  });

  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.font("Pretendard").fontSize(8).fillColor("#9ca3af").text(
      `Plypick · ${page - range.start + 1}/${range.count}`,
      48,
      doc.page.height - 34,
      { width: doc.page.width - 96, align: "center", lineBreak: false },
    );
  }

  doc.end();
  const pdf = await complete;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeFilename(playlist.title)}-셋리스트.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
