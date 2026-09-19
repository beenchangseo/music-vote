# Supabase 리전 이전 런북 (ap-southeast-1 → ap-northeast-2)

Vercel 함수는 서울(`icn1`)인데 DB 가 싱가포르에 있어 서버 렌더마다 왕복이 130ms 씩 쌓인다.
Supabase 는 생성 후 리전을 바꿀 수 없으므로 서울 리전에 새 프로젝트를 만들어 옮긴다.

**되돌릴 수 없는 작업이 포함된다.** 기존 프로젝트는 전환 후에도 최소 2주 유지한다.

## 기대 효과

| 구간 | 현재 | 이전 후 기대 |
|---|---|---|
| Vercel(icn1) → DB 왕복 | 약 130ms | 5~15ms |
| 합주방 TTFB (중앙값) | 0.65초 | 0.4초 안팎 |

## 전제

- 전환은 트래픽이 없는 심야에 한다.
- 전환 중 짧은 쓰기 유실 가능성을 감수한다.
- 기존 프로젝트를 삭제하지 않는다. 롤백은 환경변수를 되돌리고 재배포하는 것이다.

## 준비 (전환 전, 며칠 전에 해도 됨)

1. **Supabase CLI 설치**
   ```bash
   brew install supabase/tap/supabase
   supabase --version
   ```

2. **서울 리전 프로젝트 생성**
   - Supabase Dashboard → New project
   - Region: **Northeast Asia (Seoul) / ap-northeast-2**
   - 이름은 기존과 구분되게 (예: `plypick-seoul`)
   - DB 비밀번호는 안전한 곳에 보관

3. **연결 문자열 확보** (두 프로젝트 모두)
   - Dashboard → Project Settings → Database → Connection string → **URI**
   - 직접 연결이 IPv6 전용이라 실패하면 **Session pooler**(포트 5432) 문자열을 쓴다.
     transaction pooler(6543)는 `pg_dump` 에 쓰지 않는다.

4. **확장 기능 맞추기**
   - 기존 프로젝트는 `citext` 를 쓴다(`supabase-schema.sql`). 신규 프로젝트에서
     Database → Extensions 에서 `citext` 가 켜져 있는지 확인한다.
     복원 과정에서 `CREATE EXTENSION` 이 포함되지만, 미리 확인해두면 실패를 줄인다.

5. **카카오 앱 Redirect URI 추가** — 전환 전에 미리 넣어둔다
   - Kakao Developers → 내 애플리케이션 → 카카오 로그인 → Redirect URI
   - 추가: `https://<신규-project-ref>.supabase.co/auth/v1/callback`
   - 기존 URI 는 롤백을 위해 **지우지 않는다**

## 전환 (심야)

연결 문자열은 비밀번호를 담고 있으므로 파일에 적지 않고 셸 변수로만 둔다.

```bash
export SOURCE_DB_URL='postgresql://postgres.xxxx:PASSWORD@...singapore...:5432/postgres'
export TARGET_DB_URL='postgresql://postgres.yyyy:PASSWORD@...seoul...:5432/postgres'
```

1. **전환 직전 원본 현황 기록**
   ```bash
   bash scripts/compare-supabase-projects.sh --source-only
   ```

2. **덤프 + 복원**
   ```bash
   bash scripts/migrate-supabase-region.sh
   ```
   덤프 파일은 `.migration/` 에 떨어진다. gitignore 대상이며 전환 후 지운다.

3. **행 수 대조**
   ```bash
   bash scripts/compare-supabase-projects.sh
   ```
   `playlists`, `songs`, `votes`, `comments`, `setlist_items`, `song_versions`,
   `playlist_members`, `auth.users` 가 모두 일치해야 한다.

4. **신규 프로젝트에 카카오 provider 설정**
   - Dashboard → Authentication → Providers → Kakao
   - 기존 프로젝트와 **같은** REST API 키 / Client Secret 을 넣는다.
     그래야 기존 사용자의 카카오 식별자가 그대로 매칭된다.

5. **환경변수 교체**
   - Vercel Dashboard → Settings → Environment Variables (Production)
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - 로컬 `.env` 도 같이 교체 (롤백을 위해 기존 값은 따로 보관)

6. **재배포**
   ```bash
   vercel --prod
   ```
   빈 커밋 push 로 자동 배포를 태워도 된다.

7. **검증**
   ```bash
   node scripts/audit-anon-access.mjs        # 공개 키 권한이 그대로인지
   ```
   - `https://plypick.kr/` 홈 통계가 이전 값과 같은지
   - 합주방 페이지의 점수가 이전과 같은지
   - **카카오 로그인 직접 해보기** (가장 중요)
   - 투표 한 번 하고 되돌리기
   - TTFB 재측정

## 알아둘 것

- **모든 사용자가 로그아웃된다.** 프로젝트마다 JWT 시크릿이 달라 기존 세션이 무효가 된다.
  다시 로그인하면 되고, `user_id` 는 보존되므로 방장 권한과 투표 기록은 그대로다.
- `auth.users` 를 함께 옮기지 못하면 `playlists.creator_user_id`,
  `playlist_members.user_id`, `votes.user_id` 가 전부 끊어진다. 3번 대조에서
  `auth.users` 수가 다르면 진행하지 말고 중단한다.
- Vercel Cron 은 프로젝트 설정이라 DB 이전과 무관하게 그대로 동작한다.

## 롤백

환경변수 3개를 기존 값으로 되돌리고 재배포한다. 기존 프로젝트는 건드리지 않았으므로
전환 시점 이후 신규 프로젝트에 쌓인 데이터만 유실된다.

## 전환 후 정리 (2주 뒤)

- `.migration/` 삭제 (이미 전환 직후 삭제했어야 한다)
- 카카오 Redirect URI 에서 구 프로젝트 항목 제거
- 구 Supabase 프로젝트 일시정지 또는 삭제
