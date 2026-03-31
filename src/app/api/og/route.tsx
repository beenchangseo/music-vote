import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Plypick";
  const subtitle = searchParams.get("subtitle") || "";
  const songs = searchParams.get("songs") || "0";
  const participants = parseInt(searchParams.get("participants") || "0", 10) || 0;
  const isHome = !!subtitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1025 0%, #0a0a0f 50%, #0f1a2e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 20px 40px rgba(139, 92, 246, 0.3)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            maxWidth: "80%",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        {/* Info */}
        <div
          style={{
            fontSize: 24,
            color: "#9ca3af",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          {isHome ? (
            <span>{subtitle}</span>
          ) : (
            <>
              <span>{songs}곡 등록</span>
              {participants > 0 && (
                <>
                  <span style={{ color: "#4b5563" }}>·</span>
                  <span>{participants}명 참여</span>
                </>
              )}
              <span style={{ color: "#4b5563" }}>|</span>
              <span>Plypick</span>
            </>
          )}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 32,
            padding: "12px 32px",
            borderRadius: 12,
            background: "#8b5cf6",
            color: "white",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          투표에 참여하세요
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
