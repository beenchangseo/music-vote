import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { redirectToCanonicalHost } from "../canonical-host";

function request(url: string, init: { method?: string; host?: string } = {}) {
  const { host = new URL(url).host, method = "GET" } = init;
  return new NextRequest(url, { method, headers: { host } });
}

describe("redirectToCanonicalHost", () => {
  it("sends a page on the public vercel.app alias to the same path on plypick.kr for good", () => {
    const res = redirectToCanonicalHost(request("https://music-vote-ten.vercel.app/about?ref=x"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://plypick.kr/about?ref=x");
  });

  it("leaves API routes alone so Vercel Cron keeps working on the vercel.app host", () => {
    expect(redirectToCanonicalHost(request("https://music-vote-ten.vercel.app/api/cron/auto-confirm-setlist"))).toBeNull();
  });

  it("leaves non-GET requests alone (server actions from a tab opened there)", () => {
    expect(redirectToCanonicalHost(request("https://music-vote-ten.vercel.app/playlist/abc", { method: "POST" }))).toBeNull();
  });

  it("does nothing on plypick.kr or on a per-deployment URL", () => {
    expect(redirectToCanonicalHost(request("https://plypick.kr/about"))).toBeNull();
    expect(redirectToCanonicalHost(request("https://music-vote-dsigwiuqu-beenchangseos-projects.vercel.app/about"))).toBeNull();
  });
});
