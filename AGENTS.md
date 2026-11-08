<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
├── app/          라우트. 페이지·레이아웃·API route(OG·셋리스트 이미지·PDF·cron·실시간 재조회)
├── actions/      "use server" Server Action. 화면이 부르는 쓰기·읽기
├── domain/       순수 규칙과 엔티티 타입. 프레임워크·DB·브라우저를 모른다
├── lib/          바깥 연결과 서버 헬퍼. supabase/·youtube·analytics·seo·kakao, 권한 검사(playlist-access 등)
├── components/
│   ├── ui/       primitives (Button·Chip·Switch·SegmentedControl·SongRow·NoticeCard·Modal 등, 목록은 디자인 시스템 절)
│   ├── playlist/ 플레이리스트 화면 뼈대와 후보곡 탭
│   ├── setlist/  셋리스트 탭
│   ├── rehearsal/ 합주 탭과 메트로놈
│   ├── band/     밴드 홈·초대·밴드 시트 (다른 화면이 쓰는 밴드 부품 포함)
│   ├── home/     랜딩·로그인 홈·새 플레이리스트 폼
│   ├── auth/     카카오 로그인
│   ├── recording/ 녹음 점검(/lab/recording). LAB_USER_IDS 에 든 계정 말고는 404
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
| 실시간 알림마다 다시 받는 읽기(셋리스트·댓글) | `src/app/api/playlist/[playlistId]/*/route.ts` GET + `src/lib/playlist-refetch.ts`. proxy 는 POST 를 IP·경로당 분당 30회로 세서, 액션으로 두면 같은 와이파이의 밴드가 한도에 걸린다(#45) |
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

값은 `src/app/globals.css` `@theme inline`, 각 색의 쓰임과 놓일 수 있는 표면은 `src/components/ui/tokens.ts` 에 있다.
새 토큰은 두 곳에 같이 더한다. 어긋나거나 허용한 조합이 대비 기준(글자 4.5:1, 테두리·링 3:1) 아래로 떨어지면
`tokens.test.ts` 가 실패한다. 전체 모습은 `next dev` 의 `/design` 에서 본다(운영 배포에서는 404).

**색 역할.** 보라와 빨강은 채움·글자·tint 를 나눈다. 한 색으로는 흰 글자와 어두운 표면 위 글자를 둘 다 맞출 수 없다.

| 무엇을 칠하나 | 토큰 |
|---|---|
| 주 버튼·켜진 스위치 바탕 | `bg-primary` + `text-on-primary`, hover `primary-hover`, 눌림 `primary-pressed` |
| 어두운 표면 위 보라 글자·아이콘·순위 | `text-primary-fg` (hover 는 `on-primary-tint`) |
| 선택 칩·세그먼트·하단 탭·tonal 보라 바탕 | `bg-primary-tint` + `text-on-primary-tint` |
| 선택 상태 테두리 | `border-primary-fg` (`border-primary` 는 tint 위에서 3:1 이 안 나온다) |
| 위험 버튼 바탕 | `bg-danger` + `text-on-danger`, hover `danger-hover` |
| 주의 배지 바탕 | `bg-warning-tint` + `text-warning` (`warning-soft` 위 warning 글자는 4.22:1 이라 금지) |
| 빨강 글자·오류 문구 | `text-danger-fg` |
| 고른 투표 화살표 원판 (투표 알약 `bg-surface-hover` 위) | `bg-success-tint` + `text-success`, `bg-danger-tint` + `text-danger-fg` |
| 입력칸·꺼진 스위치 테두리 / 키보드 포커스 | `border-border-input` / `ring-focus-ring` |

- `text-primary`·`text-danger`·`primary-soft` 는 eslint 가 막는다(`eslint.config.mjs`). 옛 클래스를 옮길 때는
  `node scripts/codemods/ds1-color-roles.mjs` 를 돌린다.
- 표면은 `bg` → `surface`(카드·시트) → `surface-hover`(tonal·칩·입력 채움) → `surface-elevated`(토스트·메뉴) 순으로 한
  단계씩 쌓는다. `text-subtle` 은 `surface-elevated` 위에 두지 않는다(4.08:1). 그 자리는 `text-muted`.
- `border`·`border-strong` 은 구분선이다. 입력 경계로 쓰지 않는다.

**크기.** 모서리 `rounded-badge` 6 · `rounded-control` 12(버튼·입력·칩) · `rounded-card` 16 · `rounded-t-sheet` 24 ·
`rounded-pill`. 높이 `h-control-sm` 36(누르는 영역은 44) · `h-control-md` 44 · `h-control-lg` 52 · `control-hero` 64(둥근 주 원판), 행 `min-h-row` 56(설정·멤버)
· `min-h-row-song` 72(곡). 그림자는 `shadow-float` 하나이고 시트·토스트·FAB 에만 쓴다. 다른 층은 표면 색으로 만든다.
화면에 붙는 막대(`ScreenToolbar`·`TabBar`·`MiniPlayer` 막대)는 `ui/chrome-inset.ts` 로 자기 높이를 알리고, `html` 의
scroll-padding 이 그만큼 비운다. 막대 밑으로 스크롤되는 여백을 `scroll-mt-*` 같은 숫자로 따로 적지 않는다.
홈 인디케이터 자리는 `pb-safe-bottom` 이다. body 가 비우고, 그 자리를 스스로 칠하는 아래 막대는 `data-safe-bottom` 을 달아
body 의 몫을 가져간다. `env(safe-area-inset-bottom)` 을 임의 값이나 음수 margin 으로 적지 않는다.
타이포는 `text-display`·`text-h1`~`text-h4`·`text-body`·`text-sm`·`text-caption`, 한국어 줄간격 1.5 이상. 폰트는 Pretendard
Variable(한국어) + Geist(영문) 폴백.

**모션.** `duration-120`(누름) · `duration-200`(색·페이드) · `duration-300`(시트), 이징은 `ease-standard` 하나. transition
기본값이 200ms 와 이 이징이다. 애니메이션은 `animate-fade-in`·`animate-slide-up`·`animate-vote-pop`·`animate-score-in`
·`animate-gradient`·`animate-float-{slow,mid,fast}`·`animate-bounce-slow`·`animate-pulse-soft`.

**부품.** 새 화면은 `src/components/ui/` 위에 쌓는다. 인라인 클래스를 복사하지 않는다. 모두 `/design` 에 있다.

- `Button`: variant `primary`·`tonal`·`ghost`·`danger`·`kakao`, size `sm`·`md`·`lg`·`icon`, `loading`(aria-busy).
  버튼처럼 보이는 `<Link>` 는 `buttonClassName()`. 카카오 노랑은 `kakao` 변형으로만 칠한다(말풍선 표시를 그린다).
  `Input pill`(검색 칸) 옆 버튼은 `pill` 로 모서리를 맞춘다. 글자는 어느 폭에서도 한 줄이고, 버튼은 담긴 칸보다 넓어지지
  않는다(#79). 고정 문구가 칸에 안 들어가면 문구를 줄인다. 밴드 이름처럼 길이를 모르는 글자는 그 부분만 `truncate` span 에
  담아 말줄임한다(방 설정의 「{밴드}에 넣기」).
- 켜고 끄는 버튼은 `pressed` 다(켜지면 primary, `aria-pressed`). `ToolbarButton` 의 `pressed` 도 같은 것이다. 켜고 꺼도
  폭이 그대로여야 한다. 폭이 바뀌면 좁은 화면에서 줄이 꺾여 카드가 길어진다. 글자는 두 상태에서 같게 두거나(메트로놈)
  같은 글자 수의 한글로만 바꾸고(편집 ↔ 완료. Pretendard 한글은 글자 폭이 같다), 켜졌을 때만 움직이는 표시(박자 점)도
  꺼졌을 때 자리를 둔다.
- 채운 `primary` 버튼은 화면에 하나다. 나란한 보조 동작은 `tonal`, 덜 중요한 동작은 `ghost`. 같은 일을 하는 버튼을 두
  개 두지 않는다. 나란한 버튼 둘은 `ButtonGroup` 이다. 긴 쪽 글자가 반 폭에 들어가면 같은 폭 두 칸이고, 안 들어가면
  iOS 알림 버튼처럼 한 줄에 하나씩 꽉 찬 폭으로 쌓인다(먼저 쓴 버튼이 위). 홈의 「플레이리스트 만들기」·「밴드 만들기」는
  390px 에서도 쌓인다. 줄보다 긴 `truncate` 이름은 `Button` 안에서 줄 폭으로 말줄임되지만, `buttonClassName` 링크는 글자 칸이
  줄지 않아 넘치므로 `ButtonGroup` 안 링크에는 truncate 글자를 두지 않는다(eslint).
- 고르기: 필터·켜고 끄는 선택지는 `Chip`(36px, 누르는 영역 44px), 한 화면 안 보기·방식 하나는 `SegmentedControl`
  (radiogroup), 켜고 끄기는 `Switch`(label 을 주면 줄 전체가 눌린다), 화면 아래 탭은 `TabBar`.
- 목록: 곡은 `SongRow`(카드 없이 72px, 48px 커버, 고정 폭 `RankNumber`), 설정·멤버는 `ListRow`(56px)를 시트 안에서
  `ListGroup` 으로 묶는다. 줄 전체가 눌리면 `ListRowButton`, 줄 전체가 링크면 `ListRowLink` 다. 둘은 `SongRow` 처럼 내용을 열 가장자리에 두고 hover 바탕만 양옆 8px 밖까지 편다. 그래서 시트 제목·위 글자와 같은 세로줄에 서고, 옆에 다른 칸을 두면 8px 이상 띄운다. 버튼 안에 div 를 둘 수 없어 칸이 span 이다.
  펼치는 곡 행의 제목 줄은 `SongRowTitleButton`, 펼친 아래 동작은 `ActionTab` 을 `ActionTabBar` 에 담는다(바탕 없는 44px 탭, 끝에 ⋯ `IconButton`). 사람은 `Avatar`·`AvatarStack`, 메타·상태는 `Badge`(neutral·primary·warning).
  가로로 넘기는 줄(홈의 내 밴드)은 `Shelf` 다. 페이지 여백까지 넘치는 음수 margin 은 그 안에만 둔다.
- 메뉴: 눌러 여는 작은 메뉴는 트리거와 같은 relative 부모 안의 `MenuPanel` 에 `MenuItemButton`·`MenuItemLink`(44px,
  위험한 동작은 tone `danger`)를 넣는다(로그인 메뉴).
- 안내: 닫을 수 있는 안내는 `NoticeCard`(늘 닫기가 있고, 닫힘 기억은 부르는 쪽), 상태가 이어지는 동안 남는 안내는
  `InlineNotice`, 빈 목록은 `EmptyState`(screen·inline). 성공 확인을 띄우는 토스트는 아직 없다.
- 입력: `Field`(라벨 위, 도움말·오류 아래, aria 를 이어 준다) 안에 `Input`·`Textarea`.
- `Modal` 은 모바일 시트다(surface 바탕, 그래버, 위 모서리 24, `shadow-float`). 시트 안 묶음·칸은 `surface-hover` 로
  한 단계 올린다. 머리는 제자리에 있고 본문만 스크롤된다. 본문이 길어도 보여야 하는 아래 칸(댓글 입력)은 `footer` 다. `useDialog()`(`DialogProvider`): alert·confirm·danger 확인창.
- `Card`: variant `default`·`elevated`·`outline`·`selected`(목록에서 지금 고른 한 장, `border-primary-fg`), 그림자 없음. 카드 끝까지
  닿는 아래 칸(펼친 코멘트)은 `footer` 다. 음수 margin 으로 padding 을 지우지 않는다. `IconButton`: tone `default`·`danger`·`brand`, `bare`, 44px,
  `aria-label` 필수. `ScreenToolbar`: 후보곡·셋리스트·합주 상단의 숫자와 동작. 동작은 `ToolbarButton`(44px, `compact` 면
  640px 아래에서 아이콘만)으로만 그린다.
- `RoundButton`: 플레이어·플레이리스트 머리·메트로놈 줄의 둥근 아이콘 버튼. size `md` 44·`lg` 52·`hero` 64, tone `plain`(재생
  컨트롤처럼 또렷한 글리프)·`ghost`(Button ghost 처럼 흐린 글리프)·`tonal`·`inverse`(흰 원판)·`primary`·`danger`·`kakao`, hero 는 원판
  tone 만 된다. 켜고 끄기는 tone 대신 `pressed`(꺼지면 ghost, 켜지면 primary-fg 글리프). 투표 화살표는 tone `upvote`·`downvote` 에 `chosen` 이다(고른 쪽에 옅은 원판, aria-pressed 없음). 글리프 크기는 버튼이 정하니 svg 에 크기·margin 을
  두지 않는다(eslint). 재생 삼각형은 `PlayPauseIcon`. 링크는 `RoundLink`, `edge="start"` 면 글리프가 내용 왼쪽 끝에 맞는다. 둥근 버튼을
  모은 줄은 `RoundRow` 다. 원은 줄지 않고 간격이 준다.
- 크기는 prop 이 정한다. `Button`·`ButtonGroup`·`IconButton`·`Chip`·`RoundButton`·`ListRowButton`·`ListRowLink` 의 className 에 높이·폭·여백·모서리·글자 크기를 덧칠하면 eslint 가
  막는다. className 에는 바깥 배치(margin·`flex-1`·`shrink-0`·표시 여부)만 둔다.
- 글자가 있는 부품(`Button`·`buttonClassName`·`ToolbarButton`·`Chip`·`SegmentedControl`·`TabBar`·`ActionTab`·`MenuItem*`·`Badge`)의
  글자는 줄을 바꾸지 않는다. 부품에서 `whitespace-nowrap` 이 빠지면 `primitives.test.tsx` 가, 부르는 쪽 className 에
  `whitespace-normal`·`text-wrap`·`text-balance` 를 두거나 버튼을 바로 담은 줄에 `*:min-w-0`·`[&>button]:min-w-0`·`*:max-w-*`
  를(`**:`·`[&_*]:` 는 어느 깊이든) 주면 eslint 가 막는다. 나란한 버튼 줄을 손으로 만들지 않고 `ButtonGroup` 을 쓴다.
- **손으로 그린 컨트롤.** `src/components/ui` 밖에서 높이·여백·모서리·글자 크기를 칠한 `<button>` 과 바탕·테두리에 크기까지 칠한 `<a>`·`<Link>` 는
  eslint(`ds/no-raw-control`)가, `<input>`·`<textarea>` 는 `ds/no-raw-input` 이, 포커스 ring 없이 outline 을 지운 클래스는
  `ds/focus-ring` 이 막는다. 셋 다 봐주는 baseline 이 없는 그냥 에러다. 링크는 버튼 모양이면 `buttonClassName()`, 둥근 아이콘이면 `RoundLink`,
  줄이면 `ListRowLink`, 카드면 `Card` 안에 바탕 없는 링크로 그린다. 글자 칸은 `Input`·`Textarea`, submit 같은 버튼 type 은 `Button` 이고,
  `<input>` 을 그대로 두는 것은 checkbox·radio·range·hidden·file 뿐이다. `eslint-disable` 주석으로 넘겨도 `npm test` 의 `ds-inventory` 테스트가 잡는다. lint 가 막지 않는 토큰 밖 모서리·글자 크기·임의 값,
  ui 밖 음수 margin 은 `node scripts/ds-inventory.mjs` 가 파일·줄마다 보여 준다. 글리프를 내용 끝에 맞추는 자리(`RoundLink edge="start"`)처럼 어긋남을 보정하는 margin 은 부품이 한 번만 갖는다.

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
  GA(`NEXT_PUBLIC_GA_ID`)도 같은 이벤트를 받지만 페이지 주소·제목은 `src/domain/google-analytics.ts` 표의 가린 값만
  받아서, 새 페이지는 그 표에 더하고 이벤트 속성은 그냥 `string` 으로 두지 않는다.

## 마이그레이션

규칙의 원본은 `supabase/README.md`, 절차는 `db-migration` 스킬이다. 세 가지만 기억한다.

- main 에 들어간 `supabase/migrations/vNN.sql` 은 고치지 않는다. 다음 번호 파일을 만든다(`npm run db:new`).
- 새 테이블은 권한을 기본값에 기대지 않고 `REVOKE`·`GRANT` 로 적는다(v22 부터).
- 운영 DB 적용은 운영자의 승인을 받고, 적용 뒤 `npm run audit:anon` 을 돌린다.

## 주의 사항

- 로컬 빌드는 `NODE_ENV=production npx next build` 로 돌린다. 운영자의 Claude Code 전역 설정(`~/.claude/settings.json` 의
  `env`)이 `NODE_ENV=development` 를 넣어서, 그대로 빌드하면 `/_global-error` prerender 가 `useContext` null 로 실패한다.
  Next 회귀가 아니라 환경변수가 원인이다(16.2.1·16.4.3 에서 같다). Vercel 은 production 으로 빌드한다.
- Node 는 `.nvmrc` 의 24.22.1 이다(`nvm use`). `package.json` `engines.node` 는 `^24.22.1` 이라 Vercel 은 24.x 의
  최신 패치를 고르고, 로컬에서 더 낮은 Node 로 설치하면 npm 이 경고만 한다. `>=` 범위로 바꾸면 Vercel 이 26.x 로 올라간다.
- `src/lib/youtube-iframe.ts` 의 `YT` namespace 는 ambient declare 다. `export type { YT }` 로만 내보내고 value import 하지 않는다.
- Spotify audio-features 는 2024-11 부터 신규 앱에 막혔다. BPM·키는 직접 입력과 탭 템포, 외부 도구 링크로 채운다.
- 익명 모드에서는 `SongWithScore.votes` 를 채우지 않는다. 계정 식별자는 어느 모드에서도 내려보내지 않는다(`docs/adr/0011`).
  화면이 계정으로 판정하던 일은 서버가 판정해 값만 내려보낸다(`isHost`·`canDelete`·`canManage`·`isMine`·`isMe`).
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
- 공개 키로는 `songs` INSERT·UPDATE, `votes` 읽기·쓰기, `teams`·`team_members` 접근이 모두 막혀 있다(`docs/adr/0013`,
  `0014`). 투표 조회는 `song_vote_summary`·`song_voters` 뷰로, 쓰기는 service_role 이나 SECURITY DEFINER 함수로 한다.
- 셋리 블록을 넣거나 순서를 바꾸는 쓰기는 `insertSetlistBlock`·`updateSetlistOrder` 를 거쳐 v26 의
  `insert_setlist_item`·`reorder_setlist_items` 로 한다. 둘이 같은 잠금으로 줄을 서서 동시에 넣어도 position 이
  겹치지 않는다. `setlist_items.position` 을 직접 쓰는 새 경로를 만들지 않는다.

## 개발 도구

| 명령 | 하는 일 |
|---|---|
| `npm run check` | typecheck · lint · test (약 8초) |
| `npm run test:e2e` | Playwright 로컬 배포 게이트. 운영 DB 에 붙는다 |
| `npm run db:new -- "제목"` | 다음 번호 마이그레이션 파일 |
| `npm run audit:anon` | 공개 키로 열린 경로 점검 |
| `npm run audit:payload` | 로그아웃 플레이리스트 화면·GET route 에 계정 id 필드가 없는지 점검 (GET 만) |
| `npm run metrics:teams` | 밴드 성공 지표 (읽기 전용) |

hook(`.claude/settings.json`, `.claude/hooks/`):

- 편집한 ts·tsx·mjs 파일을 eslint 로 바로 검사한다.
- 커밋하지 않은 코드 변경이 있으면 턴을 끝내기 전에 `npm run check` 를 돌리고, 실패하면 끝내지 못하게 막는다.
- `echo` 로 값을 넘기는 `vercel env add` 를 거부한다. main push 와 `vercel --prod` 는 확인을 묻는다.
- eslint `--suppress-all`·`--suppress-rule` 과 `eslint-suppressions.json` 편집을 거부한다. eslint CLI 는 그 파일을 스스로 읽어
  적힌 에러를 규칙과 상관없이 넘긴다. 파일이 생기면 `npm test` 도 실패한다.
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
