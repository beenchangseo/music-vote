<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plypick — Agent Guide

밴드 곡 투표 SaaS. 사용자 풀타임 1인 운영. 한국어 우선.

## 핵심 원칙

1. **모바일 first** — 모든 신규 UI는 모바일에서 먼저 동작해야 함. 터치 영역 ≥44px.
2. **카톡 공유가 코어 바이럴 루프** — 새 기능 추가 시 카톡 공유 카드에 어떻게 노출될지 먼저 고민.
3. **익명 우선** — 가입 마찰 0 유지. 회원가입/로그인 도입은 별도 큰 결정.
4. **타입·시맨틱 토큰 사용** — `text-gray-X` 대신 `text-text`/`text-text-muted`/`text-text-subtle`.
5. **밴드 멤버가 운영자** — 본인 도그푸딩이 1차 검증. 인터뷰는 출시 후 보정용.

## 디자인 시스템

`src/app/globals.css` `@theme inline`에 모든 토큰. 새 토큰 추가는 여기서.

- **컬러**: `primary`, `bg`, `surface`, `surface-hover`, `surface-elevated`, `border`, `border-strong`, `text`, `text-muted`, `text-subtle`, `success`/`warning`/`danger` + soft 변형
- **타이포**: `text-display` (2.5rem) / `text-h1` / `text-h2` / `text-h3` / `text-body` / `text-sm` / `text-caption`. 한국어 line-height 1.6+ 기본
- **폰트**: Pretendard Variable (한국어) + Geist (영문) 폴백
- **애니메이션**: `animate-fade-in`, `animate-slide-up`, `animate-gradient`, `animate-float-{slow,mid,fast}`, `animate-bounce-slow`, `animate-pulse-soft`

## UI Primitives

`src/components/ui/`:
- `Button` — variant: primary/secondary/ghost/danger, size: sm/md/lg/icon
- `Input` — invalid 상태 + focus-ring 통일
- `Card` — variant: default/elevated/outline, padding: none/sm/md/lg
- `Modal` — 포털 + ESC + 모바일 sheet + scroll lock

새 컴포넌트는 가능한 한 이 primitives 위에 쌓을 것. 인라인 클래스 복붙 X.

## 데이터 흐름

- **Server Component** `src/app/playlist/[shareCode]/page.tsx` → songs + votes + comment counts join → `PlaylistClient` 전달
- **Client Component** `PlaylistClient` → 옵티미스틱 vote/추가 → Server Action 호출
- **Server Actions** `src/actions/*` — `createServerSupabaseClient()` (anon + RLS) 또는 `createAdminClient()` (service_role, 권한 검사 필수)
- **Edge Routes** `src/app/api/*/route.ts(x)` — OG/setlist-image/setlist-ics/cron. Pretendard 폰트는 CDN fetch + edge cache 1년

## 분석

`src/lib/analytics.ts`의 `track()` 사용. **새 이벤트 추가 시** `EventMap` 타입에 먼저 등록 → 자동 IntelliSense.

## 마이그레이션

새 컬럼/테이블 필요 시 `supabase-migration-vN.sql` 추가 (idempotent — `IF NOT EXISTS` 패턴). README의 실행 순서 목록도 함께 업데이트.

## 에러 처리

- `useDialog()` (DialogProvider) — alert/confirm/danger 통일
- 분석 실패는 silent (try/catch 안에서)
- 옵티미스틱 업데이트 실패 시 자동 롤백

## 주의 사항

- `_global-error` Turbopack 프리렌더 실패는 Next 16.2.1 자체 회귀. Vercel 배포는 영향 없음, 로컬 `next build` 실패는 무시 가능 (dev 정상)
- `youtube-iframe.ts` `YT` namespace는 ambient declare — `export type { YT }`로만 export. value import 금지
- Spotify Web API audio-features는 2024-11 신규 앱 차단됨. 자동 BPM/키 채우기는 manual 입력 + 외부 도구 링크로 대체
- `votes` 테이블 RLS: SELECT 공개 (UI 게이팅으로 익명/기명 결정). 기명 모드에서만 닉네임 노출

## 한국어 카피 톤

- "~해요" 톤. 격식 X, 가벼움 X
- 페르소나 용어 그대로: "합주", "셋리스트", "단톡방", "키 변경"
- AI/SaaS 마케팅 용어 금지: "스마트", "혁신적", "AI 추천 엔진" X
- 직접 인용 활용: *"같은 얘기 또 하지 마세요"*, *"5분 컷"*

# userEmail
The user's email address is beenchangseo@gmail.com.

# currentDate
Today's date is 2026-05-11.
