import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the root to this folder. Without it Next infers the root from the outermost lockfile,
  // and a stray ~/package-lock.json made Turbopack watch the whole home directory
  // (dev server ate memory until macOS panicked, 2026-10-06).
  turbopack: { root: __dirname },
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        // search.list 의 snippet.thumbnails 는 이 호스트로 온다.
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
