import { describe, expect, it } from "vitest";
import { createRateLimiter, POST_LIMIT, rateLimitKey } from "../rate-limit";

function request(url: string, method: string, headers: Record<string, string> = {}) {
  return new Request(url, { method, headers });
}

describe("rateLimitKey", () => {
  it.each([
    ["a Server Action POST, by the first forwarded IP and the path", request("https://plypick.kr/playlist/abc123", "POST", { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "203.0.113.7:/playlist/abc123"],
    ["the query string is not part of the bucket", request("https://plypick.kr/playlist/abc123?tab=setlist", "POST", { "x-forwarded-for": "203.0.113.7" }), "203.0.113.7:/playlist/abc123"],
    ["x-real-ip when there is no forwarded chain", request("https://plypick.kr/new", "POST", { "x-real-ip": "198.51.100.2" }), "198.51.100.2:/new"],
    ["one shared bucket when the IP is unknown", request("https://plypick.kr/new", "POST"), "unknown:/new"],
    ["a page GET is not counted", request("https://plypick.kr/playlist/abc123", "GET", { "x-forwarded-for": "203.0.113.7" }), null],
    ["a HEAD is not counted", request("https://plypick.kr/playlist/abc123", "HEAD", { "x-forwarded-for": "203.0.113.7" }), null],
  ])("%s", (_case, req, expected) => {
    expect(rateLimitKey(req)).toBe(expected);
  });
});

describe("POST limiter", () => {
  const t0 = 1_000_000;

  it("lets 30 POSTs from one IP to one page through in a minute and refuses the 31st", () => {
    const allow = createRateLimiter(POST_LIMIT);
    const results = Array.from({ length: 31 }, (_, i) => allow("203.0.113.7:/playlist/abc123", t0 + i * 1000));
    expect(results.slice(0, 30).every(Boolean)).toBe(true);
    expect(results[30]).toBe(false);
  });

  it("lets requests through again once the minute from the first one has passed", () => {
    const allow = createRateLimiter(POST_LIMIT);
    for (let i = 0; i < 31; i++) allow("ip:/p", t0);
    expect(allow("ip:/p", t0 + 59_000)).toBe(false);
    expect(allow("ip:/p", t0 + 60_001)).toBe(true);
  });

  it("counts each IP and each page in its own bucket", () => {
    const allow = createRateLimiter(POST_LIMIT);
    for (let i = 0; i < 30; i++) allow("203.0.113.7:/playlist/abc123", t0);
    expect(allow("203.0.113.7:/playlist/abc123", t0)).toBe(false);
    expect(allow("198.51.100.2:/playlist/abc123", t0)).toBe(true);
    expect(allow("203.0.113.7:/new", t0)).toBe(true);
  });
});
