import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  title: "Music Vote - 밴드 곡 투표",
  description: "밴드 구성원들과 함께 다음 공연 곡을 투표로 선정하세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100 font-sans pb-[env(safe-area-inset-bottom)]">
        {children}
        <Analytics />
        <SpeedInsights />
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nk"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        <Script id="kakao-init" strategy="lazyOnload">
          {`if (window.Kakao && !window.Kakao.isInitialized()) { window.Kakao.init('6ef9ea89e2ff04b09dc1d8d8cebd3f90'); }`}
        </Script>
      </body>
    </html>
  );
}
