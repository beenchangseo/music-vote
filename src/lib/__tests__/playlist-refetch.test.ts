import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchComments, fetchSetlistItems } from "../playlist-refetch";
import { rateLimitKey } from "../rate-limit";

const PLAYLIST_ID = "22222222-2222-4222-8222-222222222222";

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  ["fetchSetlistItems", fetchSetlistItems],
  ["fetchComments", fetchComments],
])("%s", (_name, read) => {
  it("resolves with the list the route answers", async () => {
    stubFetch(200, [{ id: "a" }]);
    await expect(read(PLAYLIST_ID)).resolves.toEqual([{ id: "a" }]);
  });

  it.each([429, 500])("rejects on %i so the realtime hook reads again", async (status) => {
    stubFetch(status, { error: "x" });
    await expect(read(PLAYLIST_ID)).rejects.toThrow();
  });

  it("sends a request the proxy POST limit does not count", async () => {
    const fetch = stubFetch(200, []);
    await read(PLAYLIST_ID);

    const [path, init] = fetch.mock.calls[0];
    const sent = new Request(new URL(path, "https://plypick.kr"), { ...init, headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(rateLimitKey(sent)).toBeNull();
  });
});
