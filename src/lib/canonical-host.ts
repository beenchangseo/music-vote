import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo";

// The project's public *.vercel.app alias serves the same pages as plypick.kr and got indexed on
// its own (Google listed music-vote-ten.vercel.app/about for "밴드 투표", 2026-10). Page views
// there move to the real domain for good. API routes stay put: Vercel Cron calls the production
// deployment on a *.vercel.app host. Per-deployment URLs sit behind Vercel Authentication and are
// already noindex, so they are left alone (they are how a specific deployment gets inspected).
const PUBLIC_ALIAS_HOSTS = new Set(["music-vote-ten.vercel.app"]);

/** A 308 to the same path on plypick.kr for page requests on the public vercel.app alias, else null. */
export function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (!PUBLIC_ALIAS_HOSTS.has(host)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return null;
  return NextResponse.redirect(new URL(`${pathname}${search}`, SITE_URL), 308);
}
