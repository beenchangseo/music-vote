import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Pretendard Bold via CDN — edge fetch + 1년 캐싱
async function loadFont(weight: 700 | 800): Promise<ArrayBuffer> {
  const url =
    weight === 800
      ? "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2-subset/Pretendard-ExtraBold.subset.woff2"
      : "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2-subset/Pretendard-Bold.subset.woff2";
  const res = await fetch(url, {
    cf: { cacheTtl: 31536000 },
    next: { revalidate: 31536000 },
  } as RequestInit);
  return res.arrayBuffer();
}

type Variant = "home" | "playlist" | "decided" | "setlist";

function parseVariant(v: string | null): Variant {
  if (v === "playlist" || v === "decided" || v === "setlist") return v;
  return "home";
}

const C = {
  bg: "linear-gradient(135deg, #1a1025 0%, #0a0a0f 50%, #0f1a2e 100%)",
  brand: "#8b5cf6",
  brandSoft: "rgba(139, 92, 246, 0.15)",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  success: "#22c55e",
  border: "#374151",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const variant = parseVariant(searchParams.get("variant"));
  const title = searchParams.get("title") || "Plypick";
  const subtitle = searchParams.get("subtitle") || "";
  const songs = parseInt(searchParams.get("songs") || "0", 10) || 0;
  const participants = parseInt(searchParams.get("participants") || "0", 10) || 0;
  const topSong = searchParams.get("topSong") || "";
  const topArtist = searchParams.get("topArtist") || "";
  const topScore = parseInt(searchParams.get("topScore") || "0", 10);
  const setlistCount = parseInt(searchParams.get("setlistCount") || "0", 10);

  const [fontBold, fontExtraBold] = await Promise.all([
    loadFont(700),
    loadFont(800),
  ]);

  let body: React.ReactNode;

  if (variant === "decided" && topSong) {
    body = <DecidedView
      title={title}
      topSong={topSong}
      topArtist={topArtist}
      topScore={topScore}
      participants={participants}
      songs={songs}
    />;
  } else if (variant === "setlist") {
    body = <SetlistView
      title={title}
      setlistCount={setlistCount || songs}
      participants={participants}
    />;
  } else if (variant === "playlist") {
    body = <PlaylistView
      title={title}
      songs={songs}
      participants={participants}
    />;
  } else {
    body = <HomeView title={title} subtitle={subtitle} />;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          fontFamily: "Pretendard",
        }}
      >
        {body}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Pretendard", data: fontBold, style: "normal", weight: 700 },
        { name: "Pretendard", data: fontExtraBold, style: "normal", weight: 800 },
      ],
    },
  );
}

// ─── Variants ───────────────────────────────────────────────

function Logo({ size = 64 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 32px rgba(139, 92, 246, 0.35)",
      }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
      >
        <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303" />
      </svg>
    </div>
  );
}

function Brand() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        position: "absolute",
        top: 48,
        left: 56,
      }}
    >
      <Logo size={44} />
      <span style={{ fontSize: 28, fontWeight: 800, color: C.text }}>
        Plypick
      </span>
    </div>
  );
}

function HomeView({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <Logo size={88} />
      <div
        style={{
          marginTop: 32,
          fontSize: 64,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.03em",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            color: C.textMuted,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function PlaylistView({
  title,
  songs,
  participants,
}: {
  title: string;
  songs: number;
  participants: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        paddingTop: 130,
      }}
    >
      <Brand />

      {/* Status pill */}
      <div
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          borderRadius: 999,
          background: C.brandSoft,
          color: C.brand,
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 28,
        }}
      >
        🎤 투표 진행 중
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 76,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginBottom: 32,
          maxWidth: "92%",
        }}
      >
        {title}
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: "auto" }}>
        <Stat label="곡" value={songs} />
        {participants > 0 && <Stat label="명 참여" value={participants} />}
        <div style={{ marginLeft: "auto" }}>
          <CTAPill>지금 투표하기 →</CTAPill>
        </div>
      </div>
    </div>
  );
}

function DecidedView({
  title,
  topSong,
  topArtist,
  topScore,
  participants,
  songs,
}: {
  title: string;
  topSong: string;
  topArtist: string;
  topScore: number;
  participants: number;
  songs: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        paddingTop: 130,
      }}
    >
      <Brand />

      <div
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          borderRadius: 999,
          background: "rgba(34, 197, 94, 0.15)",
          color: C.success,
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        🎉 다음 합주곡 결정
      </div>

      <div
        style={{
          fontSize: 26,
          color: C.textMuted,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 84,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginBottom: 12,
          maxWidth: "92%",
        }}
      >
        {topSong}
      </div>

      {topArtist && (
        <div
          style={{
            fontSize: 32,
            color: C.textMuted,
          }}
        >
          {topArtist}
        </div>
      )}

      <div style={{ display: "flex", gap: 28, marginTop: "auto" }}>
        {topScore > 0 && (
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: C.success,
              padding: "12px 20px",
              borderRadius: 12,
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
            }}
          >
            +{topScore}점 1위
          </div>
        )}
        {participants > 0 && <Stat label="명 참여" value={participants} />}
        {songs > 0 && <Stat label="곡 후보" value={songs} />}
        <div style={{ marginLeft: "auto" }}>
          <CTAPill>전체 결과 보기 →</CTAPill>
        </div>
      </div>
    </div>
  );
}

function SetlistView({
  title,
  setlistCount,
  participants,
}: {
  title: string;
  setlistCount: number;
  participants: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        paddingTop: 130,
      }}
    >
      <Brand />

      <div
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          borderRadius: 999,
          background: C.brandSoft,
          color: C.brand,
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 28,
        }}
      >
        🎵 셋리스트 확정
      </div>

      <div
        style={{
          fontSize: 76,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginBottom: 32,
          maxWidth: "92%",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 38,
          color: C.text,
          fontWeight: 700,
        }}
      >
        총 {setlistCount}곡 · 다음 공연 준비 완료
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: "auto" }}>
        {participants > 0 && <Stat label="명 참여" value={participants} />}
        <div style={{ marginLeft: "auto" }}>
          <CTAPill>셋리스트 보기 →</CTAPill>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 24, color: C.textMuted, fontWeight: 700 }}>
        {label}
      </span>
    </div>
  );
}

function CTAPill({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 28px",
        borderRadius: 14,
        background: C.brand,
        color: "white",
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
      }}
    >
      {children}
    </div>
  );
}
