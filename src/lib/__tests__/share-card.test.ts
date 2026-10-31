import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_CARD_IMAGE, type SignedCard } from "@/domain/share-card";
import { readShareCard, signShareCard } from "../share-card";

const BAND: SignedCard = { kind: "band", name: "일코해제", members: 4, showDate: "2026-10-16" };
const PHISH: SignedCard = { kind: "band", name: "⚠️ 계정 정지 예정 · bit.ly/x", members: 4, showDate: null };
const SECRET = "a".repeat(64);
const OTHER = "b".repeat(64);

const read = (image: string) => readShareCard(new URL(image, "https://plypick.kr").searchParams);
/** Swap one character for another URL-safe one, so only the bytes change. */
const flip = (text: string, at: number) => text.slice(0, at) + (text[at] === "A" ? "B" : "A") + text.slice(at + 1);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signShareCard and readShareCard", () => {
  it("the route reads back the card the server signed", async () => {
    vi.stubEnv("OG_SIGNING_SECRET", SECRET);
    const image = await signShareCard(BAND);
    expect(image).toMatch(/^\/api\/og\?card=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    await expect(read(image)).resolves.toEqual(BAND);
  });

  it("the site card is the bare route and needs no signature", async () => {
    await expect(signShareCard({ kind: "site" })).resolves.toBe(SITE_CARD_IMAGE);
    expect(SITE_CARD_IMAGE).toBe("/api/og");
  });

  it.each<[string, (signed: string, other: string) => string]>([
    ["a link from before signing", () => "/api/og?variant=band&title=%E2%9A%A0%EF%B8%8F+%EA%B3%84%EC%A0%95+%EC%A0%95%EC%A7%80"],
    ["a changed signature", (signed) => flip(signed, signed.length - 5)],
    ["one card's words with another card's signature", (signed, other) => `${other.slice(0, other.lastIndexOf("."))}${signed.slice(signed.lastIndexOf("."))}`],
    ["an unknown version", (signed) => signed.replace("card=v1.", "card=v2.")],
    ["a signature cut short", (signed) => signed.slice(0, -1)],
  ])("reads the site card from %s", async (_, tamper) => {
    vi.stubEnv("OG_SIGNING_SECRET", SECRET);
    const image = tamper(await signShareCard(BAND), await signShareCard(PHISH));
    await expect(read(image)).resolves.toEqual({ kind: "site" });
  });

  it("reads the site card from a link signed with a key the server does not hold", async () => {
    vi.stubEnv("OG_SIGNING_SECRET", OTHER);
    const forged = await signShareCard(PHISH);
    vi.stubEnv("OG_SIGNING_SECRET", SECRET);
    await expect(read(forged)).resolves.toEqual({ kind: "site" });
  });

  it("keeps reading links signed before a rotation while the previous secret is set", async () => {
    vi.stubEnv("OG_SIGNING_SECRET", SECRET);
    const before = await signShareCard(BAND);
    vi.stubEnv("OG_SIGNING_SECRET", OTHER);
    vi.stubEnv("OG_SIGNING_SECRET_PREVIOUS", SECRET);
    await expect(read(before)).resolves.toEqual(BAND);
    await expect(read(await signShareCard(BAND))).resolves.toEqual(BAND);
    vi.stubEnv("OG_SIGNING_SECRET_PREVIOUS", "");
    await expect(read(before)).resolves.toEqual({ kind: "site" });
  });
});

describe("without a usable OG_SIGNING_SECRET", () => {
  it.each([
    ["unset", ""],
    ["shorter than 32 characters, which a signed link would let anyone guess offline", "x".repeat(31)],
  ])("shares and draws the site card when the secret is %s, and logs it", async (_, value) => {
    vi.stubEnv("OG_SIGNING_SECRET", SECRET);
    const signed = await signShareCard(BAND);
    vi.stubEnv("OG_SIGNING_SECRET", value);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(signShareCard(BAND)).resolves.toBe(SITE_CARD_IMAGE);
    await expect(read(signed)).resolves.toEqual({ kind: "site" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("OG_SIGNING_SECRET"));
  });
});
