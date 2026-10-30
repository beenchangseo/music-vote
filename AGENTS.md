<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plypick 에이전트 가이드

밴드 곡 투표 서비스(plypick.kr). 1인 풀타임 운영, 한국어 우선. 사람이 읽는 개요와 설치는 `README.md`,
도메인 용어는 `CONTEXT.md`, 결정의 이유는 `docs/adr/` 에 있다.

## 핵심 원칙

1. **모바일 first.** 모든 신규 UI 는 모바일에서 먼저 동작해야 한다. 터치 영역은 44px 이상이다.
2. **카톡 공유가 코어 바이럴 루프다.** 새 기능은 카톡 공유 카드에 어떻게 보일지 먼저 정한다. 결정 직후 한 번 눌러
   단톡방에 닿아야 한다.
3. **로그인은 카카오 1회까지.** 모든 플레이리스트는 카카오 로그인이 필요하다(`docs/adr/0009`). 닉네임·프로필은
   카카오에서 채우고 추가 입력 단계를 얹지 않는다. 로그인 이전 플레이리스트는 읽기 전용 보관 상태다
   (`docs/adr/0012`). 새 쓰기 경로는 `assertPlaylistWritable` 을 지나가게 한다.
4. **익명 투표가 기본값이다.** 익명 모드는 화면에서 가리는 것이 아니라 서버 응답에서 투표자를 뺀다(`docs/adr/0011`).
5. **시맨틱 토큰을 쓴다.** `text-gray-X` 대신 `text-text`·`text-text-muted`·`text-text-subtle`.
6. **밴드 멤버가 운영자다.** 본인 도그푸딩이 1차 검증이다. 인터뷰는 출시 후 보정용이다.

## 구조와 의존 방향

```
src/
├── app/          라우트. 페이지·레이아웃·API route(OG·셋리스트 이미지·PDF·cron)
├── actions/      "use server" Server Action. 화면이 부르는 쓰기·읽기
├── domain/       순수 규칙과 엔티티 타입. 프레임워크·DB·브라우저를 모른다
├── lib/          바깥 연결과 서버 헬퍼. supabase/·youtube·analytics·seo·kakao, 권한 검사(playlist-access 등)
├── components/
│   ├── ui/       primitives (Button·Card·Chip·IconButton·Input·Modal·ScreenToolbar·DialogProvider·GuitarIcon)
│   ├── playlist/ 플레이리스트 화면 뼈대와 후보곡 탭
│   ├── setlist/  셋리스트 탭
│   ├── rehearsal/ 합주 탭과 메트로놈
│   ├── band/     밴드 홈·초대·밴드 시트 (다른 화면이 쓰는 밴드 부품 포함)
│   ├── home/     랜딩·로그인 홈·새 플레이리스트 폼
│   ├── auth/     카카오 로그인
│   └── share/    카카오 공유
├── hooks/        클라이언트 훅 (재생 큐·투표·실시간·메트로놈)
└── proxy.ts      세션 갱신과 rate limit (Next 16 의 middleware)
supabase/         마이그레이션 vNN.sql 과 적용 규칙 (supabase/README.md)
e2e/              Playwright 로컬 배포 게이트 (e2e/README.md)
scripts/          운영 스크립트 (공개 키 점검, 지표, 마이그레이션 생성)
verification/     TLA+ 형식 검증 (verify-vote-quota 스킬)
```

의존은 한 방향으로 흐른다. `domain` 은 아무것도 import 하지 않고, `lib` 와 `actions` 는 `domain` 을 쓰고,
`app`·`components`·`hooks` 는 그 위에 있다. `src/domain` 의 경계는 eslint 가 막는다(`eslint.config.mjs`).

새 코드를 둘 곳:

| 무엇 | 어디 |
|---|---|
| 입력 검사·계산·정렬 같은 순수 규칙 | `src/domain/<개념>.ts` + `src/domain/__tests__` 표 테스트 |
| 화면(클라이언트)이 부르는 쓰기·읽기 | `src/actions/<개념>.ts`. 절차는 `server-action` 스킬 |
| 서버 컴포넌트나 다른 액션만 부르는 헬퍼 | `src/lib/` 일반 모듈. `"use server"` 를 붙이지 않는다 |
| 화면 부품 | `src/components/<화면 또는 개념>/`. 여러 화면이 쓰면 개념 폴더에 둔다 |
| 스키마·권한 변경 | `npm run db:new`. 절차는 `db-migration` 스킬 |

## 컨벤션

- **파일 이름.** 컴포넌트는 `PascalCase.tsx`, 훅은 `useCamelCase.ts`, 나머지는 `kebab-case.ts`.
  테스트는 대상 옆 `__tests__/<대상>.test.ts(x)`.
- **import.** `@/` 절대 경로를 기본으로 쓴다.
- **이름.** 코드·DB 는 `playlist`·`team`, 화면은 "플레이리스트"·"밴드"다. `room`(insertRoom, RoomTeam)은
  플레이리스트의 옛 이름이다. "admin" 은 두 뜻이다. `createAdminClient` 는 service_role 키,
  `assertPlaylistAdmin`·`adminToken` 은 방장이다.
- **Server Action.** export 한 함수는 공개 엔드포인트다. 스스로 로그인·권한을 검사하고, 새 액션은 예상된 실패를
  `{ success: false, reason }` 으로 돌려준다. 프로덕션은 throw 된 메시지를 가린다. 자세한 절차는 `server-action` 스킬.
- **테스트.** 쓰는 사람이 보는 동작을 확인한다. domain 은 표 테스트, actions 는 `__tests__/fake-supabase.ts`,
  컴포넌트는 Testing Library. 끝내기 전에 `npm run check` 를 통과시킨다.
- **주석.** 코드가 말하지 못하는 이유만 적는다. 주변 코드의 언어를 따른다.
- **커밋.** Conventional Commits. 제목은 한국어 평서문("~한다"), scope 는 영역(`playlist`, `band`, `db`, `seo`, `dev`).
  본문에 왜 바꿨는지와 어떻게 확인했는지를 적는다.
- **배포.** `main` push 가 곧 프로덕션 배포다. 작업은 브랜치에서 하고, 절차는 `prod-deploy` 스킬.

## 디자인 시스템

토큰은 모두 `src/app/globals.css` `@theme inline` 에 있다. 새 토큰도 여기에 더한다.

- **컬러**: `primary`, `bg`, `surface`, `surface-hover`, `surface-elevated`, `border`, `border-strong`, `text`,
  `text-muted`, `text-subtle`, `success`·`warning`·`danger` + soft 변형
- **타이포**: `text-display`(2.5rem)·`text-h1`·`text-h2`·`text-h3`·`text-body`·`text-sm`·`text-caption`. 한국어
  line-height 는 1.6 이상
- **폰트**: Pretendard Variable(한국어) + Geist(영문) 폴백
- **애니메이션**: `animate-fade-in`, `animate-slide-up`, `animate-gradient`, `animate-float-{slow,mid,fast}`,
  `animate-bounce-slow`, `animate-pulse-soft`

새 컴포넌트는 `src/components/ui/` primitives 위에 쌓는다. 인라인 클래스를 복사하지 않는다.

- `Button`: variant primary·secondary·ghost·danger, size sm·md·lg·icon
- `Input`: invalid 상태와 focus-ring 통일
- `Card`: variant default·elevated·outline, padding none·sm·md·lg
- `Modal`: 포털, ESC, 모바일 sheet, scroll lock
- `useDialog()`(`DialogProvider`): alert·confirm·danger 확인창

## 데이터 흐름

- **Server Component** `src/app/playlist/[shareCode]/page.tsx` 가 songs·투표 집계·댓글 수를 모아
  `components/playlist/PlaylistClient` 에 넘긴다.
- **Client Component** `PlaylistClient` 는 투표·곡 추가를 옵티미스틱하게 그리고 Server Action 을 부른다.
  실패하면 되돌린다.
- **Server Action** 은 `createServerSupabaseClient()`(publishable 키 + 세션, RLS 적용) 또는
  `createAdminClient()`(secret 키, RLS 우회라 권한 검사 필수)를 쓴다.
- **Export route** `src/app/api/*`: OG·셋리스트 이미지는 Edge, 셋리스트 PDF 는 Node, cron 은 서버 런타임.
  Pretendard 는 CDN 에서 받는다.
- **분석**: `src/lib/analytics.ts` 의 `track()`. 새 이벤트는 `EventMap` 타입에 먼저 등록한다. 분석 실패는 조용히 넘긴다.

## 마이그레이션

규칙의 원본은 `supabase/README.md`, 절차는 `db-migration` 스킬이다. 세 가지만 기억한다.

- main 에 들어간 `supabase/migrations/vNN.sql` 은 고치지 않는다. 다음 번호 파일을 만든다(`npm run db:new`).
- 새 테이블은 권한을 기본값에 기대지 않고 `REVOKE`·`GRANT` 로 적는다(v22 부터).
- 운영 DB 적용은 운영자의 승인을 받고, 적용 뒤 `npm run audit:anon` 을 돌린다.

## 주의 사항

- 로컬 빌드는 `NODE_ENV=production npx next build` 로 돌린다. 운영자의 Claude Code 전역 설정(`~/.claude/settings.json` 의
  `env`)이 `NODE_ENV=development` 를 넣어서, 그대로 빌드하면 `/_global-error` prerender 가 `useContext` null 로 실패한다.
  예전에는 Next 16.2.1 회귀로 알았지만 원인은 환경변수였다. Vercel 은 production 으로 빌드한다.
- `src/lib/youtube-iframe.ts` 의 `YT` namespace 는 ambient declare 다. `export type { YT }` 로만 내보내고 value import 하지 않는다.
- Spotify audio-features 는 2024-11 부터 신규 앱에 막혔다. BPM·키는 직접 입력과 탭 템포, 외부 도구 링크로 채운다.
- 익명 모드에서는 `SongWithScore.votes` 를 채우지 않는다. 계정 식별자는 어느 모드에서도 내려보내지 않는다(`docs/adr/0011`).
- 실시간은 내용 없는 broadcast 알림 뒤 재조회다(`docs/adr/0010`). `postgres_changes` 구독은 익명 모드를 뚫으므로
  eslint 가 막는다.
- YouTube `search.list` 는 하루 100회 쿼터를 모든 사용자가 나눠 쓴다. 키 입력마다 부르지 않고, 명시적 제출에서만
  `youtube_search_cache` 를 거쳐 부른다. `videos.list` 는 50개 묶음에 1유닛이라 부담이 없다.
- Supabase 는 서울 리전(`ap-northeast-2`, ref `vwygluhbrxtfcegkmgid`) 프로젝트다(2026-10-07 싱가포르에서 이전).
  키는 새 형식이고 변수 이름만 옛것이다. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 에 `sb_publishable_…`,
  `SUPABASE_SERVICE_ROLE_KEY` 에 `sb_secret_…`. 새 키는 JWT 가 아니니 디코드해서 역할을 읽지 않는다. secret 키는
  브라우저 User-Agent 로 오면 401 이라 서버 코드에서만 쓴다. 레거시 JWT 키는 새로 쓰지 않는다.
- Vercel 환경변수는 `printf '%s' "$VAL" | vercel env add NAME production --force --yes` 로 넣는다. `echo` 는 값 끝에
  줄바꿈을 붙여 Realtime 이 `HTTP Authentication failed` 로 죽었다. hook 이 막는다.
- RLS 나 조건에 막힌 UPDATE·DELETE 는 **에러 없이 0행**이다. 쓰기 뒤 `.select("id")` 로 행 수를 확인한다.
  이걸 빼서 키·BPM 저장이 한동안 조용히 실패했다.
- 공개 키로는 `songs` UPDATE, `votes` 읽기·쓰기, `teams`·`team_members` 접근이 모두 막혀 있다(`docs/adr/0013`,
  `0014`). 투표 조회는 `song_vote_summary`·`song_voters` 뷰로, 쓰기는 service_role 이나 SECURITY DEFINER 함수로 한다.

## 개발 도구

| 명령 | 하는 일 |
|---|---|
| `npm run check` | typecheck · lint · test (약 8초) |
| `npm run test:e2e` | Playwright 로컬 배포 게이트. 운영 DB 에 붙는다 |
| `npm run db:new -- "제목"` | 다음 번호 마이그레이션 파일 |
| `npm run audit:anon` | 공개 키로 열린 경로 점검 |
| `npm run metrics:teams` | 밴드 성공 지표 (읽기 전용) |

hook(`.claude/settings.json`, `.claude/hooks/`):

- 편집한 ts·tsx·mjs 파일을 eslint 로 바로 검사한다.
- 커밋하지 않은 코드 변경이 있으면 턴을 끝내기 전에 `npm run check` 를 돌리고, 실패하면 끝내지 못하게 막는다.
- `echo` 로 값을 넘기는 `vercel env add` 를 거부한다. main push 와 `vercel --prod` 는 확인을 묻는다.
- main 에 들어간 마이그레이션 파일 편집을 거부한다.

스킬(`.claude/skills/`): `server-action`, `db-migration`, `prod-deploy`, `verify-vote-quota`.

## 한국어 카피 톤

- "~해요" 톤. 격식도 가벼움도 아니다.
- 페르소나 용어를 그대로 쓴다: "합주", "셋리스트", "단톡방", "키 변경".
- 화면 이름은 **플레이리스트**다. 후보곡·셋리스트·합주 탭이 있는 `/playlist/[shareCode]` 하나를 가리킨다
  (2026-10-05 "합주방"에서 바꿈). 코드 주석·ADR·계획 문서의 "합주방"·"방"은 같은 것이다. 화면 문구에 "합주방"을
  새로 쓰지 않는다. 역할 이름 "방장"은 그대로 쓴다.
- AI·SaaS 마케팅 용어를 쓰지 않는다: "스마트", "혁신적", "AI 추천 엔진".
- 직접 인용을 활용한다: *"같은 얘기 또 하지 마세요"*, *"5분 컷"*.
