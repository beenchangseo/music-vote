# e2e — 로컬 배포 전 게이트

Playwright 로 배포 전에 손으로 돌리는 회귀 게이트예요. CI 도 Preview 배포도 스테이징 DB 도 없어서
**`next dev` 를 띄워 운영 Supabase 에 붙여** 돌립니다. 로그인은 카카오뿐이라 테스트 전용 카카오 계정 2개의
저장된 로그인 상태(storageState)를 씁니다. (계획: `docs/plans/2026-09-21-teams-and-shared-catalog.md` T3)

> **운영 DB 에 붙어요.** 읽기만 하는 스펙이 대부분이지만 `방 만들기`·`댓글 쓰기/고치기/지우기` 두 스펙은
> 운영 DB 에 씁니다. 둘 다 끝나면(실패해도) service_role 로 지웁니다. 아래 "운영 DB 와 정리" 참고.

## 처음 한 번 하는 설정

1. 브라우저 설치 (Chromium 만): `npx playwright install chromium`
2. 테스트 전용 카카오 계정 2개를 준비합니다. 개인 계정을 쓰지 마세요.
3. 앱을 켜 둡니다: `npm run dev` (로그인 콜백이 앱을 거쳐요)
4. 다른 터미널에서 계정별로 로그인 상태를 저장합니다.

   ```bash
   npm run e2e:auth -- account-a   # 열린 브라우저에서 카카오 로그인 → 앱 화면이 보이면 터미널에서 Enter
   npm run e2e:auth -- account-b   # 같은 방식으로 두 번째 계정
   ```

   `e2e/.auth/account-a.json`, `account-b.json` 이 생깁니다 (gitignore, 권한 600). 세션 토큰이 들어 있으니
   공유하거나 커밋하지 마세요. `e2e:auth` 는 Node 의 TypeScript 직접 실행을 쓰므로 Node 22.18 이상이 필요해요.
5. **고정 테스트 방**을 하나 만듭니다. 읽기 스펙이 이 방을 읽기만 해요.
   - 후보곡 1곡 이상, **셋리스트에 곡 1곡 이상**
   - (선택) account-a 로 아무 곡에 한 번 투표해 두면 "내 표" 확인까지 돌 수 있어요 (`E2E_ACCOUNT_A_HAS_VOTE`)
   - account-a 가 이 방에 댓글을 하나도 남기지 않은 상태여야 해요. 이미 있으면 댓글 스펙은 덮어쓰지 않으려고 건너뜁니다
6. 환경 변수를 `.env.local` 에 넣습니다 (`.env` 도 읽어요, `.env.local` 이 우선).

## 환경 변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `E2E_ROOM_SHARE_CODE` | 방 스펙 전부 | 고정 테스트 방의 `share_code` |
| `E2E_ACCOUNT_IDS` | **쓰는 스펙 2개** | 테스트 계정 2개의 Supabase user id (UUID, 쉼표 구분). 성공 지표에서 이 계정들을 빼는 데 쓰는 목록이에요. 여기에 없는 계정으로는 운영 DB 에 쓰는 스펙을 돌리지 않습니다 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 쓰는 스펙 2개 | 정리 헬퍼가 씁니다. 이미 `.env` 에 있어요. 값은 출력하지 않아요 |
| `E2E_ROOM_TITLE` | 선택 | 있으면 방 제목이 정확히 같은지까지 확인 |
| `E2E_ACCOUNT_A_HAS_VOTE` | 선택 | `1` 이면 "내 표" 강조가 실제로 그려지는지 확인 (5번 선택 항목을 해 둔 경우) |

user id 는 로그인 상태를 저장한 뒤 `npm run test:e2e` 를 처음 돌리면 시작 요약에
`E2E_ACCOUNT_IDS 에 account-a 의 user id(…)가 없어요` 로 나와요. 그 값을 복사해 넣으세요.

## 돌리기

```bash
npm run test:e2e                              # 전부
npx playwright test --project=anon            # 로그아웃 상태만
npx playwright test --project=account-a       # 첫 번째 계정만
npx playwright test -g "metronome"            # 이름으로 골라서
npx playwright test --list                    # 목록만 (아무것도 실행 안 함)
```

- 이미 `npm run dev` 가 떠 있으면 그걸 재사용하고, 없으면 자동으로 띄웁니다.
- 직렬 실행(`workers: 1`, `fullyParallel: false`)이에요. 같은 계정의 로그인 상태를 컨텍스트 둘이 동시에 쓰면
  Supabase 재사용 감지가 토큰 계열 전체를 폐기하기 때문입니다. 병렬로 바꾸지 마세요.
- 빠진 조건(로그인 상태 파일, 환경 변수)은 시작할 때 한 번에 요약해서 보여주고, 그 조건이 필요한 스펙만
  건너뜁니다. 나머지는 그대로 돌아요.

## 스펙

| 프로젝트 | 파일 | 하는 일 | 쓰기 |
| --- | --- | --- | --- |
| `anon` | `anon/public.spec.ts` | `/sitemap.xml` 에 `/playlist/` 없음 · 고정 방 제목·곡 렌더 · 메트로놈 페이지 · 셋리스트 이미지(PNG, 5KB 초과) · 셋리스트 PDF(`%PDF-`) | 없음 |
| `account-a` | `account-a/room-read.spec.ts` | 같은 방의 후보곡·셋리스트·합주 탭이 데이터와 함께 뜸, 투표 버튼(내 표 영역) | 없음¹ |
| `account-a` | `account-a/room-create.spec.ts` | `/new` 에서 방 만들기 → 방 페이지 도착 | **방 1개** |
| `account-a` | `account-a/comment.spec.ts` | 고정 방의 곡에 댓글 쓰기 → 고치기 → 지우기 → 새로고침 뒤에도 없음 (DB 로도 확인) | **댓글 1개** |
| `account-b` | `account-b/session.spec.ts` | 두 번째 계정 로그인 상태가 살아 있음 (밴드 흐름 스펙(T9)이 여기에 붙어요) | 없음 |

¹ 로그인한 계정이 방을 열면 앱이 `playlist_members` 에 그 계정을 한 줄 등록합니다(멱등). 테스트 계정이라
지표에서 빠지는 대상이에요.

## 운영 DB 와 정리

- 쓰는 스펙이 만드는 방 제목·댓글 내용은 모두 `[e2e]` 로 시작합니다.
- 스펙은 쓰기 **전에** 정리 대상을 등록하고(`cleanup` fixture), 끝날 때 지웁니다. fixture 정리는 스펙이
  실패하거나 시간 초과여도 돌아요. 정리가 실패하면 스펙도 실패로 보고되고 지워지지 않은 행이 메시지에 나옵니다.
- 지우는 범위는 **테스트 계정 id AND `[e2e]` 접두어**예요. 진짜 사용자의 데이터나 고정 방은 걸리지 않아요.
- 실행 도중 강제 종료(Ctrl-C, 크래시)해서 정리를 못 한 경우를 위해, 다음 `npm run test:e2e` 시작 때
  테스트 계정의 `[e2e]` 방·댓글을 먼저 쓸어냅니다 (`global-setup.ts`).
- 정리 헬퍼는 `helpers/cleanup.ts`.

## 로그인 상태 되쓰기

앱의 proxy 가 요청마다 Supabase 토큰을 갱신하고 리프레시 토큰은 한 번 쓰면 끝이에요. 저장 파일을 그대로
두면 액세스 토큰(기본 1시간)이 만료된 뒤의 첫 실행이 리프레시 토큰을 써 버려서 다음 실행부터 로그인이
풀립니다. 그래서 각 테스트가 끝날 때 갱신된 상태를 같은 파일에 되씁니다 (`fixtures.ts`). 세션 쿠키가 없는 상태로는 덮어쓰지 않아요. 그래도
`account-b 로그인 상태에 세션이 없어요` 같은 안내가 나오면 `npm run e2e:auth -- account-b` 를 다시 하세요.

## 주의

- `test-results/` 의 trace 에는 요청 쿠키가 들어갑니다. 공유하지 마세요 (gitignore).
- 셀렉터는 role·텍스트를 씁니다. `src/` 에 test id 는 없어요.

## 지름길의 천장 (`dec-60acf136`)

이 게이트는 **로컬 7/10 짜리 지름길**입니다.

- 손으로 돌려야 해요. 안 돌리면 게이트가 없는 것과 같아요 (CI 가 막아주지 않음).
- 운영 DB 에 씁니다. 정리 실패나 강제 종료 사이에는 `[e2e]` 행이 잠깐 남을 수 있어요.
- 카카오 로그인 상태는 사람이 다시 저장해야 할 때가 있어요.

Vercel Preview 배포나 스테이징 Supabase 가 생기면 CI 로 올리고 스테이징 DB 에서 돌리세요
(`playwright.config.ts`·`helpers/cleanup.ts` 맨 위의 `gstack-shortcut(dec-60acf136)` 마커를 찾으면 돼요).
