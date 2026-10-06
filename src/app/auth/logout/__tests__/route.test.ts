import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { signOut } }),
}));

import { POST } from "../route";

describe("POST /auth/logout", () => {
  it("ends the session on this device only and goes home", async () => {
    signOut.mockResolvedValue({ error: null });
    const res = await POST(new NextRequest("https://plypick.kr/auth/logout", { method: "POST" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://plypick.kr/");
  });
});
