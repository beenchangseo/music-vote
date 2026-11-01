// 서버 전용. 공유 카드 서명 키(OG_SIGNING_SECRET)를 쓰므로 화면에서 import 하지 않는다 (eslint 가 막는다).
// 서명하는 카드는 이 요청에서 DB 에서 읽거나 막 쓴 값으로만 만든다. 클라이언트가 보낸 글자에 서명하는 액션을
// 만들면 #35 의 구멍이 POST 뒤로 옮겨질 뿐이다.
import {
  base64Url,
  decodeShareCard,
  encodeShareCard,
  SITE_CARD_IMAGE,
  type CardImage,
  type ShareCard,
} from "@/domain/share-card";

const VERSION = "v1";
// A signed link is public, so a short secret could be guessed offline from any card in a chat.
const MIN_SECRET_LENGTH = 32;

function usable(secret: string | undefined): string | null {
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

async function hmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

// subtle.verify would compare too, but whether it runs in constant time on the Edge runtime is not ours to see.
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `/api/og?card=v1.<payload>.<sig>`. 키가 없으면 site 카드를 주고 로그를 남긴다. */
export async function signShareCard(card: ShareCard): Promise<CardImage> {
  if (card.kind === "site") return SITE_CARD_IMAGE;
  const secret = usable(process.env.OG_SIGNING_SECRET);
  if (!secret) {
    console.error("[share-card] OG_SIGNING_SECRET 이 없거나 32자보다 짧아 공유 카드를 기본 카드로 보낸다");
    return SITE_CARD_IMAGE;
  }
  const token = `${VERSION}.${encodeShareCard(card)}`;
  return `/api/og?card=${token}.${await hmac(secret, token)}` as CardImage;
}

/** 이미지 라우트가 그릴 카드. 서명이 없거나 틀리면 site 카드다. 받은 글자 그대로 검증한 뒤에야 푼다. */
export async function readShareCard(params: URLSearchParams): Promise<ShareCard> {
  const site: ShareCard = { kind: "site" };
  const parts = params.get("card")?.split(".");
  if (!parts || parts.length !== 3 || parts[0] !== VERSION) return site;
  const [version, payload, sig] = parts;

  // PREVIOUS keeps cards signed before a rotation drawing until the operator clears it.
  const secrets = [usable(process.env.OG_SIGNING_SECRET), usable(process.env.OG_SIGNING_SECRET_PREVIOUS)].filter(
    (secret) => secret !== null,
  );
  if (secrets.length === 0) {
    console.error("[share-card] OG_SIGNING_SECRET 이 없거나 32자보다 짧아 모든 공유 카드를 기본 카드로 그린다");
    return site;
  }
  for (const secret of secrets) {
    if (sameText(await hmac(secret, `${version}.${payload}`), sig)) return decodeShareCard(payload) ?? site;
  }
  return site;
}
