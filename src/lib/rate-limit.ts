/** What proxy lets through per key. Every write is a Server Action, and Server Actions are POSTs. */
export const POST_LIMIT = { limit: 30, windowMs: 60_000 } as const;

/** The bucket a request counts against, or null when proxy does not limit it. */
export function rateLimitKey(request: Request): string | null {
  if (request.method !== "POST") return null;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${new URL(request.url).pathname}`;
}

/**
 * Lets `limit` requests per key through in each fixed window.
 * The counts live in one server instance's memory: a cold start clears them and instances count separately.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweepAt = 0;

  return function allow(key: string, now: number): boolean {
    if (now > nextSweepAt) {
      for (const [k, window] of windows) {
        if (now > window.resetAt) windows.delete(k);
      }
      nextSweepAt = now + windowMs;
    }
    const window = windows.get(key);
    if (!window || now > window.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (window.count >= limit) return false;
    window.count++;
    return true;
  };
}
