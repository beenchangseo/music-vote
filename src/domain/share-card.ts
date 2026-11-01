import { inviteDescription, type InviteSongs } from "./invite-card";
import { shareableShowDate } from "./team";

/**
 * 공유 카드 이미지(/api/og) 한 장에 그리는 것. 글자를 그대로 그리므로 site 가 아닌 카드는 서버가 서명한
 * 링크(src/lib/share-card.ts)로만 나간다. 서명 없는 링크는 누구의 글자도 없는 site 카드가 된다 (#35).
 */
export type ShareCard =
  | { kind: "site" }
  | { kind: "invite"; title: string; participants: number; songs: InviteSongs }
  | { kind: "decided"; title: string; participants: number; songs: number; top: { title: string; artist: string; score: number } }
  | { kind: "setlist"; title: string; participants: number; setlistCount: number }
  | { kind: "band"; name: string; members: number; showDate: string | null };

export type SignedCard = Exclude<ShareCard, { kind: "site" }>;

declare const signed: unique symbol;
/** /api/og 주소. src/lib/share-card.ts 만 만든다. 클라이언트 컴포넌트는 prop 으로 받아 그대로 보낸다. */
export type CardImage = string & { readonly [signed]: true };

/** 로고와 한 줄 소개만 있는 카드. 서명이 필요 없고, 이미지 검색에 들어가는 유일한 카드다. */
export const SITE_CARD_IMAGE = "/api/og" as CardImage;

const SIGNED_KINDS: ReadonlySet<string> = new Set<SignedCard["kind"]>(["invite", "decided", "setlist", "band"]);

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 서명하는 글자. 같은 카드는 같은 글자라 CDN 과 카카오가 한 벌만 둔다. */
export function encodeShareCard(card: SignedCard): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(card)));
}

/** encodeShareCard 의 반대. 서명을 확인한 뒤에만 부른다. 카드가 아니면 null. */
export function decodeShareCard(payload: string): SignedCard | null {
  try {
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const card = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
    return SIGNED_KINDS.has(card?.kind) ? (card as SignedCard) : null;
  } catch {
    return null;
  }
}

/**
 * 카톡 공유 버튼과 링크 미리보기가 같이 보내는 카드.
 * 보관된 플레이리스트(ADR 0012)는 투표를 받지 않고 제목의 주인인 카카오 계정도 없으니 site 카드를 보낸다.
 */
export function playlistShareCard(
  playlist: { title: string; archived: boolean },
  participants: number,
  songs: InviteSongs,
): { card: ShareCard; description: string } {
  if (playlist.archived) {
    return { card: { kind: "site" }, description: inviteDescription({ cover: [], names: [], count: songs.count }, participants) };
  }
  return {
    card: { kind: "invite", title: playlist.title, participants, songs },
    description: inviteDescription(songs, participants),
  };
}

/** 마감 뒤 결과 배너와 셋리스트 배너의 카드. `ranked` 는 화면의 점수 순서이고 [0] 이 1위다. */
export function playlistResultCards(
  playlist: { title: string; archived: boolean; setlistCount: number | null },
  participants: number,
  ranked: readonly { title: string; artist: string | null; score: number }[],
): { decided: ShareCard; setlist: ShareCard } {
  const [top] = ranked;
  if (playlist.archived || !top) return { decided: { kind: "site" }, setlist: { kind: "site" } };
  return {
    decided: {
      kind: "decided",
      title: playlist.title,
      participants,
      songs: ranked.length,
      top: { title: top.title, artist: top.artist ?? "", score: Math.max(0, top.score) },
    },
    setlist: { kind: "setlist", title: playlist.title, participants, setlistCount: playlist.setlistCount || ranked.length },
  };
}

/** 밴드 초대 카드. 지난 공연 날짜는 싣지 않는다 (25A). */
export function bandCard(name: string, members: number, nextShowAt: string | null, now: Date): ShareCard {
  return { kind: "band", name, members, showDate: shareableShowDate(nextShowAt, now) };
}
