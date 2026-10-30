# Plypick

밴드 곡을 투표로 정해요. YouTube 링크를 붙이면 멤버들이 카카오 로그인 한 번으로 5분 안에 다음 합주 곡을 정합니다.

**Live:** [plypick.kr](https://plypick.kr)

> *"카톡 단톡방에서 '다음 주에 정하기로' 끝나던 곡 결정을, 5분 만에 끝내는 밴드 투표 도구."*

## 무엇을 하나

- **투표.** 카카오 로그인 한 번으로 찬성·반대. 자유 투표 또는 방장이 정하는 투표권 할당(1~99), 익명·기명 모드
- **곡 추가.** 링크를 붙이거나 곡 이름으로 YouTube 를 검색해 미리 듣고 추가. 제목·아티스트·썸네일·재생시간은 자동
- **곡 메타와 필터.** 키, BPM(탭 템포), 길이, 난이도, 장르로 고르고 거른다
- **실시간.** 같은 플레이리스트를 연 화면끼리 바뀌었다는 알림을 받고 다시 읽는다
- **셋리스트.** 마감 뒤 매일 KST 자정에 상위 곡을 자동 확정하거나 방장이 바로 확정. 곡·인터벌·자작곡 블록과 토탈 시간
- **합주 탭.** 메트로놈, 악보 사이트 바로가기, 곡별 댓글
- **밴드.** 밴드 홈, 초대 링크, 공연 날짜, 플레이리스트 묶기
- **공유.** 카톡 리치 카드(OG 5종: home·playlist·decided·setlist·band), Kakao → Web Share → 클립보드 순서로 시도,
  셋리스트 세로 이미지(1080×1920)와 PDF

## 기술 스택

| 영역 | 기술 |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline`), Pretendard Variable |
| Database | Supabase Postgres + RLS (서울 `ap-northeast-2`) |
| Auth | Kakao OAuth (Supabase Auth) |
| Realtime | Supabase Realtime broadcast |
| Hosting | Vercel (서울 `icn1`), Vercel Cron, Analytics, Speed Insights |
| Test | Vitest + Testing Library, Playwright(로컬 e2e 게이트) |

## 로컬에서 띄우기

필요한 것: Node.js 20 이상(`npm run e2e:auth` 는 22.18 이상), Supabase 프로젝트, Kakao Developers 앱.

1. 의존성을 설치한다.

   ```bash
   npm install
   ```

2. 환경변수 파일을 만들고 값을 채운다. 각 변수의 뜻은 파일 안에 있다.

   ```bash
   cp .env.example .env.local
   ```

3. Supabase SQL Editor 에서 `supabase/migrations/v01.sql` 부터 `v22.sql` 까지 차례로 실행한다.
   순서와 규칙은 [`supabase/README.md`](supabase/README.md).
4. 개발 서버를 켠다.

   ```bash
   npm run dev
   ```

   http://localhost:3000 에서 열린다.

Kakao JavaScript SDK 키는 `src/components/share/KakaoInit.tsx` 에 들어 있다. Kakao 앱의 Web 플랫폼 도메인에
`http://localhost:3000` 을 등록해야 공유와 로그인이 된다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run check` | typecheck · lint · test (약 8초). 커밋 전 기본 게이트 |
| `npm test` | vitest 만 |
| `npm run test:e2e` | Playwright 배포 전 게이트. 운영 DB 에 붙는다 ([`e2e/README.md`](e2e/README.md)) |
| `npm run db:new -- "제목"` | 다음 번호 마이그레이션 파일을 템플릿으로 만든다 |
| `npm run audit:anon` | 공개 키로 열린 읽기·쓰기 경로를 점검한다 |
| `npm run metrics:teams` | 밴드 성공 지표 (읽기 전용) |

## 배포

`main` push 가 곧 Vercel 프로덕션 배포다. 다른 브랜치는 배포하지 않고 Preview 배포도 없다.
DB 마이그레이션이 있는 변경은 **마이그레이션의 배포 순서를 먼저 확인한다**(`supabase/README.md` 의 표).

```bash
npm run check
git switch main && git merge --no-ff <branch> && git push origin main
```

`vercel.json` 이 정하는 것:

- `regions: ["icn1"]`: 서울에서 함수를 실행한다
- `crons`: 매일 15:00 UTC(KST 자정)에 `/api/cron/auto-confirm-setlist` 로 셋리스트를 자동 확정한다
- `git.deploymentEnabled`: `main` 만 배포한다. 환경변수가 Production 스코프에만 있어 Preview 는 끈다

Vercel 환경변수는 `printf '%s' "$VAL" | vercel env add NAME production --force --yes` 로 넣는다.
`echo` 는 값 끝에 줄바꿈을 붙인다. 전체 절차는 `.claude/skills/prod-deploy/SKILL.md`.

## 구조

```
src/
├── app/          라우트와 API route
├── actions/      Server Action
├── domain/       순수 규칙과 엔티티 타입 (외부 의존 없음, eslint 로 강제)
├── lib/          Supabase·YouTube·Kakao·분석 연결, 서버 헬퍼
├── components/   ui/ 와 화면별 폴더 (playlist·setlist·rehearsal·band·home·auth·share)
└── hooks/        클라이언트 훅
supabase/         마이그레이션과 적용 규칙
e2e/              Playwright 로컬 게이트
scripts/          운영 스크립트
verification/     TLA+ 형식 검증 (투표권 동시성)
docs/             ADR, 계획, 결과 기록
```

폴더별 역할, 의존 방향, 새 코드를 둘 곳은 [`AGENTS.md`](AGENTS.md) "구조와 의존 방향".

## 문서

| 문서 | 내용 |
|---|---|
| [`AGENTS.md`](AGENTS.md) | 코드 규칙·구조·컨벤션·주의 사항. `CLAUDE.md` 가 이 파일을 불러온다 |
| [`CONTEXT.md`](CONTEXT.md) | 도메인 용어집 (플레이리스트, 투표권, 셋리스트 블록, 밴드) |
| [`TODOS.md`](TODOS.md) | 미룬 작업과 재개 조건 |
| [`supabase/README.md`](supabase/README.md) | 마이그레이션 적용 순서와 쓰는 규칙 |
| [`e2e/README.md`](e2e/README.md) | 로컬 e2e 게이트 설정 |
| `docs/adr/` | 결정 기록 (왜 이렇게 만들었나) |
| `docs/plans/`, `docs/results/` | 기획·구현 계획과 결과 |

## 분석 이벤트

이벤트 목록과 속성의 원본은 `src/lib/analytics.ts` 의 `EventMap` 이다. 카톡 공유 URL 에는 UTM 이 붙는다.

```
?utm_source=kakao&utm_medium=share&utm_campaign={shareCode}&variant={variant}
```

## License

MIT
