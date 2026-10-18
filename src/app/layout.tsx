import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import KakaoInit from "@/components/KakaoInit";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import DialogProvider from "@/components/DialogProvider";
import AuthButton from "@/components/AuthButton";
import { BASE_OPEN_GRAPH, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Pretendard dynamic subset: only the glyphs a page uses get downloaded. Pinned to a version so
// jsdelivr serves it as immutable for a year (the unpinned path is cached for 7 days). Loaded
// from <head> rather than an @import in globals.css so it is fetched alongside our CSS, not after it.
const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Fallback for pages without their own metadata (/new, 404, band home). No og:url here: a
// page that inherits one would tell scrapers it is the home.
const DEFAULT_TITLE = "Plypick - 밴드 곡 투표";
const DEFAULT_DESCRIPTION = "밴드 멤버들과 후보곡을 투표로 고르고 공연 셋리스트까지 정해요.";

export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  // 네이버 서치어드바이저 소유 확인. 지우면 확인이 풀린다.
  verification: {
    other: { "naver-site-verification": "0a1d9805c1590ab9e13934bfad6eb790dcd561c5" },
  },
  openGraph: { ...BASE_OPEN_GRAPH, title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        {/* The font files are CORS requests to the same host. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} precedence="default" />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text font-sans pb-[env(safe-area-inset-bottom)]">
        <DialogProvider>
          <div className="fixed top-2 right-2 z-50">
            <Suspense fallback={null}>
              <AuthButton />
            </Suspense>
          </div>
          {children}
        </DialogProvider>
        <Analytics />
        <SpeedInsights />
        <KakaoInit />
      </body>
    </html>
  );
}
