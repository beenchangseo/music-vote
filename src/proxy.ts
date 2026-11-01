import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { redirectToCanonicalHost } from "@/lib/canonical-host";
import { createRateLimiter, POST_LIMIT, rateLimitKey } from "@/lib/rate-limit";

const allowPost = createRateLimiter(POST_LIMIT);

export async function proxy(request: NextRequest) {
  // Pages on the public vercel.app alias belong on plypick.kr (duplicate in search results).
  const canonical = redirectToCanonicalHost(request);
  if (canonical) return canonical;

  // Rate limit before doing session work.
  const key = rateLimitKey(request);
  if (key && !allowPost(key, Date.now())) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/og|api/setlist-image|api/setlist-pdf).*)",
  ],
};
