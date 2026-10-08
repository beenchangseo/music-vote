import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import KakaoInit from "@/components/KakaoInit";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import DialogProvider from "@/components/DialogProvider";
import AuthButton from "@/components/AuthButton";
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

export const metadata: Metadata = {
  title: "Plypick - 밴드 곡 투표",
  description: "밴드 구성원들과 함께 다음 공연 곡을 투표로 선정하세요",
  metadataBase: new URL("https://plypick.kr"),
  // 네이버 서치어드바이저 소유 확인. 지우면 확인이 풀린다.
  verification: {
    other: { "naver-site-verification": "0a1d9805c1590ab9e13934bfad6eb790dcd561c5" },
  },
  openGraph: {
    title: "Plypick - 밴드 곡 투표",
    description: "밴드 멤버들과 다음 공연 셋리스트를 투표로 정하세요",
    url: "https://plypick.kr",
    siteName: "Plypick",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/api/og?title=Plypick&subtitle=밴드 멤버들과 셋리스트를 투표로 정하세요",
        width: 1200,
        height: 630,
        alt: "Plypick - 밴드 곡 투표 서비스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plypick - 밴드 곡 투표",
    description: "밴드 멤버들과 다음 공연 셋리스트를 투표로 정하세요",
  },
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
