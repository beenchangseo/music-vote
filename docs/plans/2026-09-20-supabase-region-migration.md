# Supabase 리전 이전 런북 (ap-southeast-1 → ap-northeast-2)

Vercel 함수는 서울(`icn1`)인데 DB 가 싱가포르에 있어 서버 렌더마다 왕복이 130ms 씩 쌓인다.
Supabase 는 생성 후 리전을 바꿀 수 없으므로 서울 리전에 새 프로젝트를 만들어 옮긴다.

**되돌릴 수 없는 작업이 포함된다.** 기존 프로젝트는 전환 후에도 최소 2주 유지한다.

> 2026-10-07 개정. 서울 프로젝트를 만든 뒤 구 프로젝트를 실측하고, 9-20 판에서 빠졌던
> 위험(권한 회수 유실, citext 스키마, 새 API 키, 쓰기 유실)을 반영했다. 바뀐 이유는 맨 아래
> "9-20 판에서 바뀐 점"에 있다.

## 진행 상황

| 단계 | 상태 |
|---|---|
| 0-1 도구 | 완료 (2026-10-07) — Docker 29.1.5 실행, DataGrip `postgres@plypick` 연결. CLI 는 2.117 그대로(올리기는 선택) |
| 0-2 신규 상태 점검 | 완료 (2026-10-07) — 아래 "신규 프로젝트 실측" |
| 0-3 신규 설정 | 완료 (2026-10-07, 운영자) |
| 0-4 카카오 Redirect URI | 완료 (2026-10-07, 운영자) |
| 0-5 API 키 | 완료 (2026-10-07) — 새 키(`sb_publishable_`/`sb_secret_`)로 결정, 레거시는 대비책. 두 키 인증 확인. `.env.local` 에 주석으로 넣어 둠 → 2-4 직전에 주석만 푼다 |
| 0-6 스크립트 보강 | 완료 (2026-10-07) — 로컬 Docker 로 권한 유실 재현·수정 확인, 0-6 의 검증 기록 참고 |
| 1 리허설 | 생략 (2026-10-07 결정, 무료 플랜이라 임시 프로젝트 불가) — 대신 2-0 시험 덤프, 02:15 중단 시각, `--restore-only` 복구 경로 |
| 2 전환 | **완료 (2026-10-07 20:47~20:57 KST)** — 아래 "전환 기록" |

## 한눈에

| 항목 | 내용 |
|---|---|
| 데이터 크기 | 14MB, 사용자 19명 — 덤프·복원 자체는 1분 안쪽. 시간 대부분은 검증이다 |
| 서비스 영향 | 쓰기 정지 약 40~60분 예상, 최대 75분(02:15 중단 시각). 읽기는 계속 됨. 전원 1회 재로그인 |
| 데이터 유실 | 0 이 목표 — 구 DB 를 읽기 전용으로 얼린 **뒤에** 덤프한다 |
| 전환 시각 | 01:00 KST 시작 (00:00 KST 셋리스트 자동 확정 cron 이 끝난 뒤) |
| 롤백 | 환경변수 교체 전: 구 DB 얼음만 푼다 / 교체 후: Vercel Instant Rollback + 얼음 해제 |

## 기대 효과

| 구간 | 현재 | 이전 후 기대 |
|---|---|---|
| Vercel(icn1) → DB 왕복 | 약 130ms | 5~15ms |
| 합주방 TTFB (중앙값) | 0.65초 | 0.4초 안팎 |

## 구 프로젝트 실측 (2026-10-07)

| 항목 | 값 | 이전에 미치는 영향 |
|---|---|---|
| Postgres | 17.6 | 신규는 17.11 — 같은 메이저 |
| 확장 | `citext`(**public 스키마**), pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault | citext 만 기본 아님 — 0-2 참고 |
| public 테이블 | 11개 (comments, playlist_admin, playlist_members, playlists, setlist_items, song_versions, songs, team_members, teams, votes, youtube_search_cache) | 전부 RLS 켜짐 |
| 뷰 / 함수 / 정책 | 5 / 6 / 9 | 복원 뒤 개수 대조 |
| 권한 지문 (비교 스크립트 ③) | 61행, md5 `8ad7e953da95e7f101410f7472559fcf` | 전환 당일 `--source-only` 로 다시 떠서 대조 (스키마가 바뀌면 값도 바뀐다) |
| 기본 권한 지문 (비교 스크립트 ④) | 24행, md5 `41c0ac679913c7e48729ec8b51e5d276` | 신규 프로젝트와 같다 |
| auth | 사용자 19명, provider 는 kakao 만 | |
| Storage | 버킷 0, 객체 0 | 옮길 파일 없음 |
| auth/storage 사용자 트리거 | 없음 | 덤프에서 빠지는 것 없음 |
| Realtime | 테이블 publication 없음, realtime 정책 없음 | 공개 broadcast 채널만 쓴다 (ADR 0010) |
| pg_cron / pg_net / Vault 비밀 | 안 씀 | cron 은 Vercel 쪽이라 무관 |
| Vercel 환경변수 | Supabase 3개, Production 에만 | Preview 는 꺼져 있다 |

## 신규 프로젝트 실측 (2026-10-07, 0-2 결과)

ref `vwygluhbrxtfcegkmgid`, 서울(ap-northeast-2).

| 항목 | 값 | 판단 |
|---|---|---|
| Postgres | 17.11 | 원본 17.6 과 같은 메이저. 문제 없음 |
| 확장 | pgcrypto·uuid-ossp·pg_stat_statements(`extensions`), supabase_vault | citext 없음 — 덤프가 `public` 에 만들게 둔다 |
| auth.users / auth.identities | 0 / 0 | 아무도 로그인하지 않았다. 복원 전까지 유지 |
| public 객체 | 테이블·뷰·함수 0 | 빈 상태 |
| 이벤트 트리거 | 원본과 같은 6개 (자동 RLS 트리거 없음) | 복원에 영향 없음 |
| **public 기본 권한** | `postgres` 가 만드는 테이블·시퀀스·함수에 anon·authenticated·service_role **전부 자동 부여** — 원본과 같다 ("Automatically expose new tables" 켜진 채 생성) | **2-3 사전 SQL 필수.** 없으면 함수(v11)뿐 아니라 테이블 권한 회수(v15·v17~v20)도 전부 되살아난다 |

## 단계 0 — 사전 준비 (D-7 ~ D-2)

### 0-1 도구

- **Supabase CLI** — 이미 있음(2.117). `brew upgrade supabase` 로 올려둔다.
- **Docker Desktop 실행** — `supabase db dump` 는 Docker 컨테이너 안에서 pg_dump 를 돌린다.
  전환 당일 켜져 있는지가 첫 확인 항목이다.
- **psql** — `/opt/homebrew/opt/libpq/bin/psql` (pg 18.4 클라이언트, 17 서버에 문제 없음).
- **연결 문자열은 두 프로젝트 모두 Session pooler(5432)** 를 쓴다. Docker 컨테이너는 macOS 에서
  IPv6 로 나가지 못해 `db.<ref>.supabase.co` 직접 연결이 덤프에서 실패한다.
  transaction pooler(6543)는 쓰지 않는다.
- **DataGrip** 에 신규 프로젝트 연결을 추가한다. 검증 SQL 을 양쪽에 같이 돌린다.
  구 `postgres@supabase`, 신규 `postgres@plypick` (둘 다 직접 연결 — DataGrip 은 IPv6 로 나갈 수 있다).

### 0-2 신규 프로젝트 상태 점검 (SQL, 신규 프로젝트에서)

```sql
SELECT current_setting('server_version');           -- 17.x 여야 한다
SELECT extname, extnamespace::regnamespace FROM pg_extension ORDER BY 1;
SELECT pg_get_userbyid(defaclrole), defaclobjtype, defaclacl
FROM pg_default_acl WHERE defaclnamespace = 'public'::regnamespace;
SELECT count(*) FROM auth.users;                     -- 0 이어야 한다
```

- **citext 를 대시보드에서 켜지 않는다.** 대시보드는 `extensions` 스키마에 설치하는데, 덤프는
  `public.citext` 타입을 참조한다. 이미 다른 스키마에 있으면 덤프의 `CREATE EXTENSION IF NOT EXISTS`
  가 그냥 지나가고 테이블 생성이 `type "public.citext" does not exist` 로 실패한다.
  덤프가 직접 만들게 두거나, 켜야 한다면 `CREATE EXTENSION citext WITH SCHEMA public;` 으로.
  이미 켰다면 `DROP EXTENSION citext;` 후 진행한다.
- `pg_default_acl` 결과는 2-3 의 사전 SQL 이 왜 필요한지 보여준다(아래 "권한 회수 유실").
- **신규 프로젝트로 로그인하지 않는다.** 복원 전에 카카오 로그인을 하면 같은 카카오 계정이 새 UUID 로
  `auth.identities` 에 들어가고, 복원이 중복 키로 통째로 실패한다. 로그인 시험은 복원 뒤에만 한다.

### 0-3 신규 프로젝트 설정 (대시보드) — 구 프로젝트 화면을 옆에 띄워 하나씩 맞춘다

- [ ] **Authentication → Sign In / Providers → Kakao**: 켜기, 구 프로젝트와 **같은** REST API 키와
  Client Secret. 같은 카카오 앱이어야 카카오 사용자 식별자가 그대로 매칭돼 `user_id` 가 이어진다.
  화면의 나머지 토글도 구 프로젝트와 똑같이 둔다.
- [ ] **Email provider**: 구 프로젝트 상태 그대로. 구에서 꺼져 있었다면 신규에서도 끈다.
  신규 기본값은 켜짐이라, 그대로 두면 이메일 가입으로 `authenticated` 를 얻는 길이 새로 열린다.
- [ ] **Anonymous sign-ins**: 꺼짐 확인.
- [ ] **URL Configuration**: Site URL `https://plypick.kr`, Redirect URLs 는 구 목록을 그대로 옮기고
  `http://localhost:3000/**` 가 있는지 확인한다 (2-4 에서 로컬로 로그인 시험을 한다).
- [ ] **Sessions / Rate limits**: JWT 만료(구 3600초), 리프레시 토큰 설정, 레이트 리밋 — 구와 같게.
- [ ] **Data API**: 켜져 있음, 노출 스키마 `public`·`graphql_public`, Max rows 구와 같게.
- [ ] **Realtime → Settings**: 공개 채널 허용(“private channels only” 꺼짐). 앱은 공개 broadcast 를 쓴다.
- [ ] **Database → Network restrictions / SSL enforcement**: 구에 설정한 게 있으면 같게.
- [ ] **Compute 크기**: 구와 같거나 크게.

### 0-4 카카오 Redirect URI

- Kakao Developers → 내 애플리케이션 → 카카오 로그인 → Redirect URI 에
  `https://vwygluhbrxtfcegkmgid.supabase.co/auth/v1/callback` 추가. (2026-10-07 완료)
- 구 URI 는 롤백을 위해 **지우지 않는다** (D+14 에 지운다).

### 0-5 API 키

신규 프로젝트에는 두 종류가 다 있다 (2026-10-07 확인 — 9-20 판 개정 때 "레거시 키가 없다"고 적은 건
틀렸다).

| 종류 | 공개용 | 서버용 |
|---|---|---|
| 새 키 | `sb_publishable_...` | `sb_secret_...` |
| 레거시 JWT | `anon` | `service_role` |

**결정: 새 키로 전환한다. 레거시 키는 당일 2-4 에서 새 키가 막혔을 때의 대비책으로만 둔다.**

- Supabase 는 레거시 키를 2026년 말에 없앤다. 이번에 레거시로 붙이면 석 달 안에 운영 환경변수를
  한 번 더 바꿔야 한다. 어차피 값을 바꾸는 이번에 같이 바꾼다.
- `service_role` JWT 는 따로 폐기할 수 없다. 새로 받으려면 JWT 시크릿을 돌려야 하고, 그러면 전원이
  로그아웃된다. `sb_secret_` 키는 하나만 골라 폐기·재발급할 수 있다.
- 코드는 바꿀 게 없다. Supabase 접근은 전부 supabase-js(2.100)·@supabase/ssr(0.9) 클라이언트를
  거치고, 키를 JWT 로 해석하거나 REST 를 직접 `fetch` 하는 곳이 없다 (`src`·`scripts`·`e2e` 확인).
- 환경변수 이름은 그대로 두고 값만 바꾼다.
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← publishable, `SUPABASE_SERVICE_ROLE_KEY` ← secret.
- secret 키는 브라우저 User-Agent 로 오면 401 이다. 서버 액션·cron·스크립트·E2E 정리 헬퍼는 Node 라 문제없다.
- 전환 당일 2-4 를 새 키로 전부 통과해야 2-5 로 간다. 키 때문에 막히면(401, Realtime 연결 실패 등)
  `.env.local` 의 두 키를 레거시 anon·service_role 로 바꿔 2-4 를 다시 하고, 2-5 도 레거시 키로 넣는다.
  새 키 전환은 따로 일정을 잡는다 (그때는 환경변수 교체와 재배포만 하면 되고 로그아웃은 없다).
- 키는 비밀번호 관리자에만 둔다. 파일·채팅에 붙이지 않는다.

### 0-6 스크립트 보강 (2026-10-07 완료)

| 스크립트 | 하는 일 |
|---|---|
| `scripts/migrate-supabase-region.sh` | **사전 점검**: Docker 켜짐 · 원본이 얼려 있음(`--rehearsal` 이면 건너뜀, 세션 값이 아니라 DB 설정을 읽는다) · 대상이 비어 있음(public 객체 + auth.users = 0) · 대상 citext 가 public 이 아닌 스키마에 없음. 하나라도 어긋나면 덤프 전에 멈춘다. **복원**: roles → 사전 SQL → schema → replica → data → 사후 SQL 을 한 트랜잭션으로. 결과는 `.migration/restore.log` |
| `scripts/compare-supabase-projects.sh` | ① 행 수: public 의 **모든** 테이블(원본에서 목록을 읽는다) + auth.users + auth.identities ② 구조: 테이블·뷰·함수·정책 수, RLS 꺼진 테이블 수 ③ 권한: public 객체별 anon·authenticated·service_role·PUBLIC 권한 ④ 기본 권한. ③④ 는 다르면 어느 줄이 다른지 `-`/`+` 로 보여준다. 하나라도 다르면 종료 코드 1. `--source-only` 는 원본 값만 찍는다 |
| `scripts/audit-anon-access.mjs` | `save_playlist_voting_settings` RPC 가 anon 에게 42501 인지 본다. 첫 인자 검사에서 끝나는 값을 보내 열려 있어도 아무것도 바뀌지 않는다 |

**검증 (2026-10-07)**

- 운영(싱가포르)에 `npm run audit:anon` — 새 RPC 프로브 포함 18개 모두 통과 (RPC 는 42501).
- 비교 스크립트의 SQL 을 구·신규 DB 에 DataGrip 으로 실행 — 둘 다 정상 동작. 기본 권한 지문이 원본과 신규가
  같다(24행, md5 `41c0ac679913c7e48729ec8b51e5d276`).
- 로컬 Docker Postgres 17.11 에 Supabase 와 같은 기본 권한을 깔고, plypick 처럼 REVOKE 로 닫은 원본을 만들어 재현:
  - **9-20 판 절차(사전 SQL 없음)**: 행 수·구조는 전부 일치하는데 권한만 어긋났다 — `save_settings` 에
    anon EXECUTE, `votes`·`playlists`·`playlist_members` 에 anon·authenticated 의 SELECT·INSERT·UPDATE·DELETE
    가 되살아났다. 비교 스크립트가 잡았다(종료 코드 1).
  - **고친 스크립트**: 권한(21행)·기본 권한(9행)까지 md5 로 일치(종료 코드 0). pg_dump 가 원본의
    `ALTER DEFAULT PRIVILEGES` 도 덤프하므로 사후 SQL 은 대비용(아무 일도 안 함)이었다.
  - 사전 점검: 얼리지 않은 원본(전환 모드), 이미 복원된 대상, `extensions` 스키마의 citext — 셋 다 덤프 전에 멈췄다.
  - 2-1 의 얼리기 SQL 뒤 새 세션 쓰기가 `cannot execute INSERT in a read-only transaction` 으로 막혔고,
    얼린 원본에서 덤프·복원은 정상이었다. 롤백의 얼음 해제 SQL 로 쓰기가 돌아왔다.
  - data 단계에서 일부러 실패시키면 대상이 완전히 빈 상태로 돌아갔다(기본 권한도 원래대로).
  - 한계: `supabase db dump` 대신 같은 플래그의 pg_dump 로 흉내 냈다. 실제 CLI 출력은 2-0 시험 덤프에서 처음 본다.
  - 리허설 생략 결정 뒤(같은 날) `--dump-only`·`--restore-only` 를 더해 같은 방식으로 시험했다: 시험 덤프는
    대상을 건드리지 않고, `supabase_admin` 소유권 줄이 섞인 덤프는 복원이 실패해 대상이 빈 채로 남았고, 그 줄을
    주석 처리한 뒤 `--restore-only` 로 복원·대조가 통과했다. 얼리기 전 덤프로 표시된 `dump.meta` 는 거부됐다.

## 단계 1 — 리허설 (생략, 2026-10-07 결정)

무료 플랜은 활성 프로젝트가 2개까지라(싱가포르·서울) 임시 프로젝트를 만들 수 없다. 리허설 없이 서울
프로젝트로 바로 전환한다.

**리허설 없이도 되는 이유** — 당일 실패해도 최악은 "그날 밤 중단, 다른 날 재시도"다. 데이터 유실이나
보안 구멍으로 이어지지 않는다.

| 실패 지점 | 결과 |
|---|---|
| 복원 실패 | 한 트랜잭션이라 대상이 빈 상태로 돌아간다. 덤프를 고쳐 `--restore-only` 로 복원만 다시 한다 |
| 권한이 어긋남 | 대조 스크립트가 잡는다. Vercel 을 바꾸기 전이라 운영 영향 없음 |
| 카카오 로그인 실패 | 2-4 에서 로컬 앱으로 먼저 본다. 역시 Vercel 을 바꾸기 전 |
| 그 밤을 포기 | 구 DB 얼음만 푼다(롤백 표 첫 줄). 잃는 데이터 없음 |

**리허설 대신 하는 것**

1. **2-0 시험 덤프** — 얼리기 전에 `--dump-only` 로 실제 CLI 덤프를 떠서 Docker·CLI·풀러 연결 문제와
   알려진 복원 오류(2-3 표)를 쓰기 정지 **전에** 드러낸다.
2. **중단 시각을 정해 둔다** — 02:15 까지 2-4 를 통과하지 못하면 얼음을 풀고 그날은 끝낸다.
   공지는 2시간(01:00~03:00)으로 넉넉히 잡는다.
3. **전환일은 서울 프로젝트가 잠들기 전에** — 무료 프로젝트는 7일간 쓰지 않으면 일시정지된다.
   2026-10-14 전에 하거나, 2-0 에서 대시보드로 활성 상태인지 확인하고 멈춰 있으면 Restore 후 진행한다.

## 단계 2 — 전환 당일

연결 문자열은 비밀번호를 담고 있으므로 파일에 적지 않고 셸 변수로만 둔다.

```bash
export SOURCE_DB_URL='postgresql://postgres.<구-ref>:PASSWORD@aws-...-ap-southeast-1.pooler.supabase.com:5432/postgres'
export TARGET_DB_URL='postgresql://postgres.<신규-ref>:PASSWORD@aws-...-ap-northeast-2.pooler.supabase.com:5432/postgres'
```

### 2-0 시작 전 (00:30 ~ 01:00)

- [ ] Docker Desktop 실행 중, `supabase --version`, `psql --version` 확인
- [ ] Vercel 대시보드 → Deployments 에서 **현재 Production 배포 URL 을 적어둔다** (롤백 대상)
- [ ] 00:00 KST cron(`/api/cron/auto-confirm-setlist`)이 성공했는지 Vercel 로그에서 확인
- [ ] 서울 프로젝트가 활성 상태인지 대시보드에서 확인 (무료 플랜 7일 비활성 일시정지)
- [ ] 단톡방에 공지: "01시~03시 점검, 그동안 투표·댓글이 저장되지 않아요. 끝나면 카카오로 한 번 다시 로그인해 주세요"
- [ ] **시험 덤프** (원본 읽기만): `bash scripts/migrate-supabase-region.sh --dump-only`
  — 끝에 나오는 "알려진 복원 오류 점검"에서 `supabase_admin`·`cli_login_postgres` 가 0줄이 아니면
  2-3 표대로 미리 대처를 정해 둔다. `GRANT` 가 0줄이면 덤프에 권한이 안 실린 것이니 **진행하지 않는다**.
  확인 뒤 `rm -rf .migration/dry-run`
- [ ] 원본 현황 기록: `bash scripts/compare-supabase-projects.sh --source-only | tee ~/plypick-source-$(date +%Y%m%d).txt`
  — 권한 지문이 2026-10-07 값(61행, `8ad7e953…`)과 다르면 그 사이 스키마가 바뀐 것이다. 이유를 알고 넘어간다.

### 2-1 구 DB 쓰기 정지 (T0)

> **2026-10-07 전환에서 바뀐 절차.** `default_transaction_read_only` 만으로는 앱 쓰기가 막히지 않았다.
> PostgREST 는 쓰기 요청마다 트랜잭션을 `READ WRITE` 로 명시해 이 기본값을 덮어쓴다(얼린 뒤 service_role
> UPDATE 프로브가 그대로 통과했다). 그래서 쓰기 차단은 **문장 단위 트리거**로 한다. 기본값 설정은 그대로
> 함께 건다 — 로그인 등 PostgREST 밖의 쓰기를 막고, 이전 스크립트의 사전 점검이 이 값을 본다.

구 프로젝트에서 실행한다. 기본값이 읽기 전용이 된 뒤라 트리거는 `BEGIN READ WRITE` 로 만든다.

```sql
-- ① 기본값 (PostgREST 밖의 쓰기, 스크립트 사전 점검용)
ALTER DATABASE postgres SET default_transaction_read_only = on;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE usename = 'authenticator' AND pid <> pg_backend_pid();

-- ② 실제 쓰기 차단: public 의 모든 테이블에 문장 단위 트리거
BEGIN READ WRITE;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.migration_write_block() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'Plypick 서버 이전 중이라 지금은 저장할 수 없어요.'
    USING ERRCODE = 'read_only_sql_transaction';
END
$fn$;
DO $do$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('CREATE TRIGGER migration_write_block BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE '
                   'ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.migration_write_block()', t);
  END LOOP;
END
$do$;
COMMIT;
```

트리거는 service_role 도, SECURITY DEFINER 함수도 피하지 못한다. 문장 단위라 0행 UPDATE 도 막힌다.
이 함수와 트리거는 덤프에 실려 신규로 간다. 2-4 대조는 양쪽에 다 있는 상태로 통과시키고, 그 뒤
**신규에서만** `DROP FUNCTION public.migration_write_block() CASCADE;` 로 지운다. 지운 뒤 신규의 권한 지문이
얼리기 전 원본 값(2-0 기록)과 같은지 `--source-only` 로 확인한다.

확인 (없는 id 를 겨누는 UPDATE 라 열려 있어도 아무것도 바뀌지 않는다):

- [ ] 구 프로젝트 service_role 키로 `playlists` 에 `update(...).eq('id', '00000000-…')` → `25006` 이어야 한다
- [ ] 같은 키로 테이블·뷰 읽기는 그대로 되는지

이 시점부터 앱 데이터(서버 액션, RPC, cron)는 구 DB 에 쓸 수 없다. 구 DB 는 전환 뒤에도 이 상태로 둔다 —
전환 전에 열어둔 탭의 쓰기가 구 DB 에 쌓이지 않게.

### 2-2 덤프 (T+5)

```bash
bash scripts/migrate-supabase-region.sh   # 사전 점검 → 덤프 3개 → .migration/, 이어서 복원까지
```

전환 모드에서는 원본이 얼려 있지 않으면 사전 점검에서 멈춘다. 2-1 을 건너뛰지 못하게 한 것이다.

`.migration/` 에는 사용자 개인정보(카카오 이메일·닉네임)가 들어 있다. gitignore 대상이며 2-7 에서 지운다.

### 2-3 복원 (T+7)

**왜 사전·사후 SQL 이 필요한가.** 신규 프로젝트는 `postgres` 가 public 에 만드는 테이블·시퀀스·함수에
anon·authenticated·service_role 권한을 전부 자동으로 붙인다 (0-2 에서 확인 — "Automatically expose new
tables" 가 켜진 채 생성됐다). pg_dump 는 권한을 "아무 기본 권한이 없는 상태" 기준으로 적기 때문에,
원본에서 REVOKE 로 닫아둔 권한(v11·v15·v17~v20)을 다시 닫는 문장이 덤프에 없다. 그대로 복원하면:

- `save_playlist_voting_settings`(SECURITY DEFINER, 호출자 검사 없음)를 anon 이 RPC 로 부를 수 있게 된다
- v20 이 닫은 `playlist_members` 직접 UPDATE(자기 투표권 올리기) 길이 다시 열린다
- v15 가 닫은 `votes`, v19 가 닫은 `teams`·`team_members` 에 anon 권한이 다시 붙는다 (RLS 가 막고는 있지만
  ADR 0013·0014 의 "권한 0" 이 깨진다)

**사전 SQL** — schema.sql 보다 먼저, 같은 트랜잭션에서 자동 부여를 끈다. 그러면 복원된 객체의 권한이
원본과 정확히 같아진다.

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
```

**사후 SQL** — data.sql 다음, 같은 트랜잭션에서 기본 권한을 원본과 같게 되돌린다. 이전은 동작을 바꾸지
않는 게 원칙이라, 앞으로 만들 객체의 기본값도 원본(= 신규 생성 직후)과 같게 둔다. schema.sql 이 이미
되돌렸다면 아무 일도 하지 않는다(멱등). 이 기본값은 2026-10-30 에 Supabase 가 테이블·시퀀스 쪽을
일괄로 끈다 — 단계 3 의 마이그레이션 규칙 참고.

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
```

순서: roles.sql → **사전 SQL** → schema.sql → `SET session_replication_role = replica` → data.sql → **사후 SQL**.
나머지는 공식 절차 그대로다 (`--single-transaction`, `ON_ERROR_STOP=1`).

**복원이 실패하면** 트랜잭션이 통째로 되돌아가 대상은 빈 상태다. 원본은 얼려 있으니 덤프도 그대로 유효하다.
아래 표대로 `.migration/` 의 파일을 고치고 **복원만** 다시 한다. 덤프를 다시 뜨면 고친 내용이 덮어써진다.

```bash
bash scripts/migrate-supabase-region.sh --restore-only
```

`--restore-only` 는 얼린 뒤에 뜬 덤프(`.migration/dump.meta` 의 `source_read_only=on`)만 받는다.
2-0 시험 덤프(`.migration/dry-run/`)는 얼리기 전 데이터라 쓰지 않는다.

| 오류 | 대처 |
|---|---|
| schema.sql 의 `supabase_admin` 관련 권한 오류 | `ALTER ... OWNER TO "supabase_admin"` 줄을 주석 처리 (Supabase 공식 문서) |
| roles.sql 의 `cli_login_postgres` grant 권한 오류 | 그 GRANT 줄을 주석 처리 (공식 문서) |
| `type "public.citext" does not exist` | 사전 점검이 막아야 정상이다. 대상에서 `DROP EXTENSION citext;` 후 다시 |
| auth 테이블 COPY 에서 컬럼 불일치 | 구·신규 Supabase auth 버전 차이. 고치지 말고 중단 — 얼음 풀고 원인 확인 후 다른 날 |
| 사전 점검의 "대상이 비어 있지 않습니다" | 누가 신규에 로그인했거나 이전 시도의 흔적. 무엇인지 확인하기 전에는 진행하지 않는다 |
| 위에 없는 오류 | 02:15 중단 시각 안에 원인이 분명하면 고쳐서 `--restore-only`, 아니면 중단 |

복원 로그는 `.migration/restore.log` 에 남는다. 2-0 시험 덤프에서 위 표의 앞 두 오류가 0줄이면
당일 복원은 한 번에 통과할 가능성이 높다.

### 2-4 검증 게이트 (T+10 ~ T+30) — 하나라도 실패하면 2-5 로 가지 않는다

1. **대조 스크립트** — `bash scripts/compare-supabase-projects.sh` 가 종료 코드 0.
   - 행 수: 특히 `auth.users`·`auth.identities`. 어긋나면 방장 권한과 투표 기록이 끊어진다.
   - 구조: 테이블 11, 뷰 5, 함수 6, 정책 9, RLS 꺼진 테이블 0 (2026-10-07 기준).
   - 권한·기본 권한: 한 줄이라도 `-`/`+` 가 나오면 멈춘다. 공개 키 경로가 다시 열린 것이다.
2. **공개 키 점검** — 신규 값으로:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<신규-ref>.supabase.co \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable> \
   node scripts/audit-anon-access.mjs
   ```
3. **로컬 앱 → 신규 DB** (`.env.local` 의 신규 3줄 주석을 풀고 `npm run dev`)
   - [ ] 홈 통계 숫자가 2-0 기록과 같다
   - [ ] 카카오 로그인 → 내 방들이 보이고 방장 권한이 있다 (= `user_id` 가 이어졌다)
   - [ ] 테스트 방에서 투표하고 되돌리기 (SECURITY DEFINER RPC 경로)
   - [ ] 곡 추가 1회 후 삭제, 댓글 1회 (authenticated INSERT 경로)
   - [ ] 탭 두 개를 열어 한쪽 투표가 다른 쪽에 반영 (Realtime broadcast)

### 2-5 운영 전환 (T+30)

`echo` 로 넣으면 값 끝에 줄바꿈이 붙어 Realtime 이 죽는다. 반드시 `printf`.

```bash
printf '%s' "https://<신규-ref>.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --force --yes
printf '%s' "$NEW_PUBLISHABLE_KEY"          | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --force --yes
printf '%s' "$NEW_SECRET_KEY"               | vercel env add SUPABASE_SERVICE_ROLE_KEY production --force --yes
vercel --prod
```

`NEXT_PUBLIC_*` 는 빌드에 박히므로 반드시 새로 빌드해야 한다 (`vercel --prod` 또는 main 에 빈 커밋 push).
`vercel --prod` 는 로컬 작업 트리를 올리므로 깨끗한 main 에서 실행한다.

### 2-6 운영 검증 (T+40 ~ T+60)

- [ ] **휴대폰 카카오톡 인앱 브라우저로** 단톡방 링크를 열어 로그인 (가장 중요)
- [ ] 홈 통계, 테스트 방 점수가 2-0 기록과 같다
- [ ] 투표·되돌리기, 댓글, 곡 추가
- [ ] 두 기기에서 실시간 반영
- [ ] OG 이미지·셋리스트 이미지·PDF 라우트 응답
- [ ] cron 수동 호출: `curl -H "Authorization: Bearer $CRON_SECRET" https://plypick.kr/api/cron/auto-confirm-setlist` → `ok: true`
- [ ] Supabase 신규 프로젝트 로그(API·Auth)에 401/42501 이 쏟아지지 않는다
- [ ] TTFB 재측정

### 2-7 완료

- 단톡방에 완료 공지
- **구 DB 는 얼린 채로 둔다.** 전환 전에 열어둔 탭은 옛 번들이라 구 프로젝트를 보고 있다.
  얼려 두면 그 탭의 쓰기는 실패할 뿐 구 DB 에 조용히 쌓이지 않는다. 새로고침하면 신규로 붙는다.
- `rm -rf .migration`
- `.env` 를 신규 값으로 바꾸고 `.env.local` 의 임시 값을 지운다. 구 값은 롤백 기간 동안 비밀번호 관리자에만.

## 롤백

| 시점 | 방법 | 잃는 것 |
|---|---|---|
| 2-5 전 (검증 실패) | 구 DB 얼음 해제, 공지 | 없음 |
| 2-5 후 ~ 2-6 끝 | Vercel 에서 2-0 에 적어둔 배포로 **Instant Rollback** (배포는 당시 환경변수를 들고 있다) + 구 DB 얼음 해제 | 그 사이 신규 DB 에 쓰인 것 (새벽이라 거의 없음, `created_at` 으로 확인) |
| 2-7 이후 | 롤백하지 않는다. 앞으로 고친다 | — |

얼음 해제 (구 프로젝트, DataGrip `postgres@supabase` 새 콘솔에서):

```sql
SET default_transaction_read_only = off;
DROP FUNCTION public.migration_write_block() CASCADE;   -- 트리거 11개도 함께 지워진다
ALTER DATABASE postgres RESET default_transaction_read_only;
```

Instant Rollback 뒤에는 Vercel 이 새 배포를 Production 에 자동으로 붙이지 않는다. 다시 전환할 때는
새로 배포한 뒤 promote 한다. 환경변수도 구 값으로 되돌려 둔다.

## 전환 기록 (2026-10-07)

쓰기 이력을 보니 01시보다 저녁 18~20시가 조용해 당일 저녁으로 당겼다(최근 30일 쓰기 142건 중 18~20시 0건).
준비가 길어져 실제로는 20:47 에 시작했다. 단톡방 공지는 하지 않았다.

| 시각 (KST) | 일 |
|---|---|
| 20:40 | 원본 현황 기록 `~/plypick-source-20261007-2040.txt` — 권한 61행 `8ad7e953…`, 기본 권한 24행 `41c0ac67…` (10-07 기준값과 같음) |
| 20:41 | 2-0 시험 덤프 실패 — CLI 가 `.env.local` 의 값 없는 줄을 해석하지 못함. 스크립트가 빈 임시 폴더에서 CLI 를 돌리게 고침(`2b8952f`) 후 통과. 알려진 복원 오류 0줄 |
| 20:47:43 | `default_transaction_read_only = on`, authenticator 연결 2개 끊음 → **프로브 결과 앱 쓰기가 그대로 통과** |
| 20:51:11 | 쓰기 차단 트리거 11개 (2-1 위 절차). 프로브: service_role UPDATE `25006`, 읽기 정상 |
| 20:51:26~20:52:14 | 덤프 + 복원 48초. 경고는 citext 확장 함수 GRANT 뿐(`supabase_admin` 소유라 postgres 가 줄 수 없음, 무해) |
| 20:52:34 | 대조 4항목 일치 (행 13테이블, 구조, 권한 65행, 기본 권한 24행 — 차단 함수 포함 상태) |
| 20:53 | 신규에서 차단 함수·트리거 삭제 → 신규 권한 지문 61행 `8ad7e953…` = 얼리기 전 원본 |
| 20:53 | 새 publishable 키로 audit 18항목 통과 |
| 20:53~20:55 | 로컬 앱 → 신규: 카카오 로그인 후 `auth.users` 19 그대로(기존 user_id, 방 9개 연결), 투표·곡·댓글·실시간 확인 |
| 20:55 | Vercel Production 환경변수 3개 교체 (`printf` + `--force`) |
| 20:56:02~20:57:05 | `vercel redeploy` (직전 운영 배포 `riia0g36x` 를 새 환경변수로 재빌드) → `plypick.kr` 연결 |
| 20:57~ | 운영 확인: 서울 전용 곡이 운영 방 페이지에 보임(서버→서울), 번들 19청크 중 서울 ref 2·publishable 2·싱가포르 0·줄바꿈 0, OG·셋리스트 이미지·PDF 200, 휴대폰 카카오톡 로그인·투표·실시간 운영자 확인 |

- 앱 쓰기 정지는 20:51:11 ~ 20:57:05, **약 6분**. 읽기는 내내 됐다.
- **TTFB (중앙값, 9회)**: 합주방 0.65초 → **0.35초**, 홈 0.22초.
- 2-0 크론 수동 호출은 로컬 `CRON_SECRET` 이 운영 값과 달라 401. 00:00 정기 실행 로그로 확인한다.
- 로컬 확인 중 테스트 방(`qDPJnh1d`)에 곡 1개(요루시카)와 댓글 1개가 남았다.
- 정리: `.migration/`·`~/.plypick-migration.env` 삭제, `.env` 를 신규 값으로 교체, `.env.local` 임시 줄 제거.
- 구 프로젝트는 쓰기 차단 트리거 + 읽기 전용 기본값이 걸린 채로 둔다.

## 단계 3 — 후속

**D+1**
- E2E 로그인 상태 다시 저장 (`e2e/save-auth.mts`) — 저장된 쿠키가 구 프로젝트 것이다. 이후 E2E 게이트 1회.
- README·AGENTS.md 의 프로젝트 ref·키 설명 갱신 (키 형식이 `sb_publishable_`/`sb_secret_` 로 바뀜).
- DataGrip 의 운영 연결을 신규로 바꾸고, 구 연결 이름에 `(old, read-only)` 를 붙인다.

**D+1 ~ D+7**
- Supabase 신규 프로젝트 Advisors(보안·성능) 확인.
- 새 키로 일주일 문제없으면 신규 프로젝트의 **레거시 API 키를 끈다** (Settings → API Keys).
  쓰지 않는 `service_role` JWT 는 폐기할 수 없는 전권 키라 켜 둘 이유가 없다.
  끈 뒤 운영·E2E·스크립트가 모두 정상인지 확인한다.
- Vercel 함수 오류율, Auth 로그 모니터링. TTFB 전후 비교를 이 문서 끝에 적는다.

**D+14**
- 카카오 Redirect URI 에서 구 프로젝트 항목 제거.
- 구 Supabase 프로젝트 일시정지. 삭제는 그 뒤 여유를 두고.

**이후 마이그레이션 규칙 (v22 부터)**
- Supabase 는 2026-10-30 부터 기존 프로젝트에도 "새 테이블 자동 노출 끔"을 적용한다. 그 뒤로 public 에
  만드는 새 테이블은 `service_role` 에게도 권한이 없다. 새 테이블 마이그레이션에는
  `GRANT ... TO service_role` (필요하면 anon·authenticated 도)을 명시한다. AGENTS.md 마이그레이션 절에 추가.

## 사용자 영향

- **모든 사용자가 한 번 로그아웃된다.** 세션 쿠키 이름에 프로젝트 ref 가 들어가 있어(`sb-<ref>-auth-token`)
  새 프로젝트는 옛 쿠키를 보지 않는다. 카카오로 다시 로그인하면 같은 `user_id` 로 이어져 방장 권한과
  투표 기록은 그대로다. 옛 쿠키가 남은 사용자는 홈에서 스켈레톤이 잠깐 보인 뒤 로그아웃 상태가 된다.
- 점검 중에는 읽기는 되고 쓰기는 오류가 난다.
- 전환 직전에 로그인을 시작한 사람은 콜백에서 `?auth_error=1` 로 돌아온다. 다시 누르면 된다.

## 9-20 판에서 바뀐 점

1. **권한 회수 유실** — 9-20 판 절차대로 복원하면 v11·v15·v17~v20 의 REVOKE 가 빠질 수 있다.
   2-3 사전 SQL 과 2-4 권한 지문 게이트를 더했다.
2. **citext 를 대시보드에서 미리 켜라는 안내 삭제** — 오히려 복원을 깨뜨린다(0-2).
3. **새 API 키** — 레거시 키가 2026년 말 없어지므로 이번 전환에서 publishable/secret 키로 바꾼다(0-5).
4. **쓰기 정지 후 덤프** — "짧은 쓰기 유실 감수"에서 "유실 0"으로. 롤백 판단도 깔끔해진다(2-1).
5. **롤백** — 환경변수 되돌리고 재빌드 대신 Vercel Instant Rollback.
6. **대조 범위** — v19 이후 테이블(teams, team_members)과 youtube_search_cache 가 빠져 있었다.
7. **Docker 필요, Session pooler 사용** 명시.
8. **복원 전 신규 프로젝트 로그인 금지** 명시.
9. 리허설은 무료 플랜이라 생략하고, 시험 덤프(`--dump-only`)·복원만 다시(`--restore-only`)·중단 시각으로 대신한다.
