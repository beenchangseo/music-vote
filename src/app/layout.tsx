import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import KakaoInit from "@/components/KakaoInit";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import DialogProvider from "@/components/DialogProvider";
import AuthButton from "@/components/AuthButton";
import "./globals.css";

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
