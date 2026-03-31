import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter (resets on cold start, sufficient for Vercel serverless)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up stale entries periodically
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

let lastCleanup = Date.now();

export function middleware(request: NextRequest) {
  // Only rate limit server action POST requests
  if (request.method !== "POST") return NextResponse.next();

  // Clean up every 60 seconds
  if (Date.now() - lastCleanup > 60000) {
    cleanup();
    lastCleanup = Date.now();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const path = request.nextUrl.pathname;

  // Rate limit server actions (Next.js server actions go through page routes as POST)
  const key = `${ip}:${path}`;

  // General rate limit: 30 requests per minute per IP per path
  if (!rateLimit(key, 30, 60000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes (OG image)
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
