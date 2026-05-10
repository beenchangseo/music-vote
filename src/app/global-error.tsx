"use client";

// Next 16 자동 _global-error 프리렌더 이슈를 명시적 페이지로 우회.
// 루트 레이아웃을 대체하므로 <html>·<body> 직접 포함 필요.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#030712",
          color: "#f3f4f6",
          fontFamily:
            '"Pretendard Variable", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            문제가 발생했어요
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              lineHeight: 1.6,
            }}
          >
            잠시 후 다시 시도해주세요. 같은 문제가 반복되면 새로고침해주세요.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: 44,
              padding: "0 1.25rem",
              borderRadius: 12,
              background: "#8b5cf6",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
