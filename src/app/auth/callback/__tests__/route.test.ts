import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "../route";

const ORIGIN = "https://plypick.kr";

async function callback(next?: string, code: string | null = "oauth-code") {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (next !== undefined) params.set("next", next);
  const res = await GET(new NextRequest(`${ORIGIN}/auth/callback?${params}`));
  return res.headers.get("location");
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it.each(["/band/x?join=1", "/new?band=x"])("passes the same-site path %s through", async (next) => {
    expect(await callback(next)).toBe(`${ORIGIN}${next}`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
  });

  it.each(["@evil.com", "//evil.com", "/\\evil.com", "https://evil.com"])(
    "sends %s to the home page instead",
    async (next) => {
      expect(await callback(next)).toBe(`${ORIGIN}/`);
    },
  );

  it("defaults to the home page without next", async () => {
    expect(await callback()).toBe(`${ORIGIN}/`);
  });

  it("reports a failed code exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    expect(await callback("/band/x?join=1")).toBe(`${ORIGIN}/?auth_error=1`);
  });

  it("reports a missing code without calling Supabase", async () => {
    expect(await callback("/band/x?join=1", null)).toBe(`${ORIGIN}/?auth_error=1`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
