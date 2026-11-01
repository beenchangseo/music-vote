import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-size";
import { readShareCard } from "@/lib/share-card";
import { formatShowDate } from "@/domain/team";
import { inviteSongsLine, type InviteCover, type InviteSongs } from "@/domain/invite-card";

export const runtime = "edge";
// The project's function region (vercel.json `regions`: icn1). On "auto" it ran in sin1.
export const preferredRegion = "home";

// A card is drawn from its signed query string alone, so the CDN keeps each URL for a week (a deploy
// also clears it). Kakao's scraper gives up on a slow image and caches the card without one.
// A bad card can be purged alone: `vercel cache invalidate --tag og-card`.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400",
  "Vercel-CDN-Cache-Control": "max-age=604800",
  "Vercel-Cache-Tag": "og-card",
};
// A card drawn without any song picture (YouTube slow, or every cover video gone) is not what the
// query asks for, so the CDN keeps it only a minute and the next scrape tries again.
const COVER_MISSED_CACHE_HEADERS = {
  ...CACHE_HEADERS,
  "Cache-Control": "public, max-age=60",
  "Vercel-CDN-Cache-Control": "max-age=60",
};

// Upper bound on fetching the song pictures. They load alongside the fonts; past this the invite
// card draws with the pictures it has, or the text-only card if none, instead of keeping Kakao's
// scraper waiting.
const COVER_TIMEOUT_MS = 1000;

// Pretendard via CDN — satori(ImageResponse)는 OTF/TTF 만 지원, WOFF2 불가
// (이전: woff2-subset → 매 요청 "Unsupported OpenType signature wO" 로 빈 PNG 반환)
// edge fetch + 1년 캐싱 (~1.5MB/weight, 첫 요청 1회 비용)
async function loadFont(weight: 700 | 800): Promise<ArrayBuffer> {
  const url =
    weight === 800
      ? "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-ExtraBold.otf"
      : "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf";
  const res = await fetch(url, {
    cf: { cacheTtl: 31536000 },
    next: { revalidate: 31536000 },
  } as RequestInit);
  // Fail the request instead of drawing a fontless card the CDN would then keep.
  if (!res.ok) throw new Error(`Pretendard ${weight} fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

/** A cover picture as a data URI. `letterboxed`: hqdefault, a 4:3 picture with the 16:9 frame between black bars. */
type CoverPicture = { src: string; letterboxed: boolean };

// YouTube thumbnail sizes, sharpest first. The lone 470px cover wants more than mqdefault's 320×180;
// maxresdefault (1280×720) is missing for some videos, hqdefault (480×360) always exists.
const LONE_SIZES = ["maxresdefault", "hqdefault", "mqdefault"];
const TILE_SIZES = ["mqdefault"];

/** The sharpest of `sizes` that loaded. All are asked at once: a missing size has taken 1.3s to 404. */
async function loadPicture(id: string, sizes: string[], signal: AbortSignal): Promise<CoverPicture | null> {
  const pictures = await Promise.all(
    sizes.map(async (size) => {
      try {
        const res = await fetch(`https://img.youtube.com/vi/${id}/${size}.jpg`, { signal });
        if (!res.ok) return null;
        return { src: `data:image/jpeg;base64,${base64(await res.arrayBuffer())}`, letterboxed: size === "hqdefault" };
      } catch {
        return null;
      }
    }),
  );
  return pictures.find((picture) => picture !== null) ?? null;
}

/**
 * The cover's pictures, fetched before drawing so the wait is bounded. Four tiles only if all four
 * loaded, otherwise the first that did, so one deleted video does not cost the whole cover.
 */
async function loadCover(cover: InviteCover): Promise<CoverPicture[]> {
  const signal = AbortSignal.timeout(COVER_TIMEOUT_MS);
  const sizes = cover.length === 1 ? LONE_SIZES : TILE_SIZES;
  const loaded = (await Promise.all(cover.map((id) => loadPicture(id, sizes, signal)))).filter((p) => p !== null);
  return loaded.length === 4 ? loaded : loaded.slice(0, 1);
}

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
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
  // Only words the server signed are drawn; any other link draws the site card (#35).
  const card = await readShareCard(request.nextUrl.searchParams);
  const wantsCover = card.kind === "invite" && card.songs.count > 0 && card.songs.cover.length > 0;

  const [fontBold, fontExtraBold, cover] = await Promise.all([
    loadFont(700),
    loadFont(800),
    wantsCover ? loadCover(card.songs.cover) : [],
  ]);

  let body: React.ReactNode;
  switch (card.kind) {
    case "decided":
      body = <DecidedView
        title={card.title}
        topSong={card.top.title}
        topArtist={card.top.artist}
        topScore={card.top.score}
        participants={card.participants}
        songs={card.songs}
      />;
      break;
    case "setlist":
      body = <SetlistView title={card.title} setlistCount={card.setlistCount} participants={card.participants} />;
      break;
    case "band":
      body = <BandView name={card.name} showDate={formatShowDate(card.showDate ?? "")} members={card.members} />;
      break;
    case "invite":
      body = cover.length > 0
        ? <InviteView title={card.title} participants={card.participants} songs={card.songs} cover={cover} />
        : <PlaylistView title={card.title} songs={card.songs.count} participants={card.participants} />;
      break;
    case "site":
      body = <HomeView title="Plypick" subtitle="밴드 합주곡, 투표로 정해요" />;
      break;
  }

  const image = new ImageResponse(
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
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fonts: [
        { name: "Pretendard", data: fontBold, style: "normal", weight: 700 },
        { name: "Pretendard", data: fontExtraBold, style: "normal", weight: 800 },
      ],
    },
  );

  // ImageResponse sends 200 before it draws. Draw the whole PNG first so a render error is a
  // 500 the CDN won't keep, not a 200 whose body breaks off.
  const png = await image.arrayBuffer();
  // Only the bare site card belongs in image search: the others carry playlist and band names, and
  // a link nobody signed would index the same picture under any address.
  const isSiteCard = request.nextUrl.search === "";
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      ...(wantsCover && cover.length === 0 ? COVER_MISSED_CACHE_HEADERS : CACHE_HEADERS),
      ...(isSiteCard ? {} : { "X-Robots-Tag": "noindex" }),
    },
  });
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
    <div style={{ display: "flex", position: "absolute", top: 48, left: 56 }}>
      <BrandMark />
    </div>
  );
}

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Logo size={44} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>
          Plypick
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.textSubtle, marginTop: 4 }}>
          plypick.kr
        </span>
      </div>
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
          display: "flex",
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
          display: "flex",
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
        <div style={{ display: "flex", marginLeft: "auto" }}>
          <CTAPill>지금 투표하기 →</CTAPill>
        </div>
      </div>
    </div>
  );
}

/** 투표 초대 카드 (#11 안 A). 왼쪽 2×2 곡 커버, 오른쪽에 제목과 먼저 올라온 곡 이름. */
function InviteView({
  title,
  participants,
  songs,
  cover,
}: {
  title: string;
  participants: number;
  songs: InviteSongs;
  cover: CoverPicture[];
}) {
  // 30px text in the 522px column, less the note mark: about 16 Hangul-wide characters.
  const line = inviteSongsLine(songs, 16);
  const tile = cover.length >= 4 ? 235 : 470;
  // A letterboxed 4:3 picture drawn 4/3 larger, centered, so the frame clips its black bars off.
  const zoomed = (tile * 4) / 3;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", padding: 80, gap: 48 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 470,
          height: 470,
          flexShrink: 0,
          borderRadius: 28,
          overflow: "hidden",
          background: "#2a3441",
        }}
      >
        {cover.map(({ src, letterboxed }, i) => {
          const size = letterboxed ? zoomed : tile;
          const margin = letterboxed ? (tile - zoomed) / 2 : 0;
          return (
            // eslint-disable-next-line @next/next/no-img-element -- satori draws plain <img>
            <img key={i} src={src} alt="" width={size} height={size} style={{ width: size, height: size, margin, objectFit: "cover" }} />
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: 470 }}>
        <BrandMark />

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 999,
              background: C.brandSoft,
              color: C.brand,
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 22,
            }}
          >
            🎤 투표 진행 중
          </div>

          <div
            style={{
              display: "block",
              lineClamp: 2,
              wordBreak: "keep-all",
              fontSize: 64,
              fontWeight: 800,
              color: C.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.12,
              marginBottom: 16,
            }}
          >
            {title}
          </div>

          {line.names && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 700, color: C.textMuted }}>
              <span style={{ color: C.brand, flexShrink: 0 }}>♪</span>
              <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", minWidth: 0 }}>{line.names}</span>
              {line.more && <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{line.more}</span>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto", paddingTop: 28 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap" }}>
            {participants > 0 ? `${songs.count}곡 · ${participants}명 참여` : `${songs.count}곡`}
          </div>
          <div style={{ display: "flex", marginLeft: "auto" }}>
            <CTAPill>지금 투표하기 →</CTAPill>
          </div>
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
          display: "flex",
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
          display: "flex",
          fontSize: 26,
          color: C.textMuted,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
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
            display: "flex",
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
              display: "flex",
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
        <div style={{ display: "flex", marginLeft: "auto" }}>
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
        position: "relative",
      }}
    >
      <Brand />

      <div
        style={{
          display: "flex",
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
          display: "flex",
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
          display: "flex",
          fontSize: 38,
          color: C.text,
          fontWeight: 700,
        }}
      >
        총 {setlistCount}곡 · 다음 공연 준비 완료
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: "auto" }}>
        {participants > 0 && <Stat label="명 참여" value={participants} />}
        <div style={{ display: "flex", marginLeft: "auto" }}>
          <CTAPill>셋리스트 보기 →</CTAPill>
        </div>
      </div>
    </div>
  );
}

/** band 카드 (/join 초대 링크). 밴드 이름과 정확한 공연 날짜만, D-day 는 싣지 않는다 (25A). */
function BandView({
  name,
  showDate,
  members,
}: {
  name: string;
  showDate: string | null;
  members: number;
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
          display: "flex",
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
        🎸 밴드 초대
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 76,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginBottom: 28,
          maxWidth: "92%",
        }}
      >
        {name}
      </div>

      {showDate && (
        <div
          style={{
            display: "flex",
            fontSize: 38,
            color: C.text,
            fontWeight: 700,
          }}
        >
          {showDate} 공연
        </div>
      )}

      <div style={{ display: "flex", gap: 32, marginTop: "auto" }}>
        {/* DR13: a band of one shows no big "1명"; the card text names who made it instead. */}
        {members > 1 && <Stat label="명" value={members} />}
        <div style={{ display: "flex", marginLeft: "auto" }}>
          <CTAPill>밴드 들어가기 →</CTAPill>
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
        display: "flex",
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
