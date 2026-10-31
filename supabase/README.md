# 데이터베이스 (Supabase Postgres)

운영 DB 는 서울 리전(`ap-northeast-2`, ref `vwygluhbrxtfcegkmgid`) 프로젝트 하나다. 스테이징 DB 는 없다.
스키마는 `migrations/` 의 SQL 을 번호 순서대로 손으로 적용해서 만든다. Supabase CLI 의 `db push` 는 쓰지 않는다.

## 적용 순서

새 환경은 `v01` 부터 `v25` 까지 차례로 SQL Editor(또는 DataGrip)에서 실행한다. `v01`·`v03` 은 `CREATE TABLE`·
`CREATE POLICY` 를 조건 없이 써서 새 환경에서 한 번만 돌릴 수 있다. 다시 돌리면 "already exists" 로 멈춘다.
나머지 파일은 `IF NOT EXISTS`·`CREATE OR REPLACE`·`DROP … IF EXISTS` 뒤 다시 만들기로 써 있어 다시 돌려도 안전하다.

| 파일 | 내용 | 코드 배포와의 순서 |
|---|---|---|
| `v01.sql` | 베이스 스키마 | |
| `v02.sql` | admin_token 분리 | |
| `v03.sql` | 댓글 + 셋리스트 | |
| `v04.sql` | creator_nickname + 공지사항 | |
| `v05.sql` | 곡 메타(key_root/mode, difficulty, genre) | |
| `v06.sql` | 익명/기명 투표 모드 | |
| `v07.sql` | Kakao OAuth 계정 연동 | |
| `v08.sql` | 로그인 모드 RLS | |
| `v09.sql` | 공연 포스터 URL (운영 이력, v10 에서 제거) | |
| `v10.sql` | 투표권·다른 버전·셋리스트 편집, 포스터 제거 | |
| `v11.sql` | 투표 설정 일괄 저장 | |
| `v12.sql` | 할당 모드 후보곡 중복 투표 | |
| `v13.sql` | 로그인 중복 투표를 막던 legacy 닉네임 제약 분리 | |
| `v14.sql` | votes(song_id) 인덱스 복구 + 통계 집계 뷰 | |
| `v15.sql` | 공개 키 쓰기 경로 차단 + 투표 조회 뷰 | |
| `v16.sql` | 집계 뷰에 playlist_id 추가 (왕복 축소) | |
| `v17.sql` | YouTube 검색 결과 캐시 | |
| `v18.sql` | 공개 키 조회 차단 + playlists 직접 생성 차단 | 코드 배포 **후** |
| `v19.sql` | 밴드(teams·team_members) + playlists.team_id·team_linked_via | 코드 배포 **전** |
| `v20.sql` | 앱이 쓰지 않는 공개 키 쓰기 권한 회수 | 무관 |
| `v21.sql` | teams.created_via 밴드 출처 | 코드 배포 **전** |
| `v22.sql` | setlist_items.item_type 에 'original'(자작곡) 허용 | 코드 배포 **전** |
| `v23.sql` | 투표가 방식을 FOR SHARE 로 읽음 + 앱이 안 쓰는 투표권 함수 3개 실행 권한 회수 (#15, #16) | 무관 |
| `v24.sql` | 마감이 지난 플레이리스트의 표를 cast_playlist_vote 가 거부 (#24) | 코드 배포 **후** |
| `v25.sql` | playlists.setlist_edit_mode 기본값을 'host_only' 로 (#22) | 무관 |

2026-10-31 전에는 이 파일들이 저장소 루트에 `supabase-schema.sql`(= `v01`)과 `supabase-migration-vN.sql`(= `vNN`)
이름으로 있었다. 옛 SQL 주석·ADR·커밋 메시지에 나오는 옛 이름은 이 규칙으로 읽는다. 적용된 파일의 바이트는
바꾸지 않았다.

## 새 마이그레이션 쓰기

`npm run db:new` 가 다음 번호 파일을 템플릿으로 만든다. 절차는 `.claude/skills/db-migration/SKILL.md` 에 있다.

- **적용한 파일은 고치지 않는다.** main 에 들어간 `vNN.sql` 은 운영 DB 에 이미 돌았다. 바꿀 내용은 다음 번호 파일에
  쓴다. `.claude/hooks/guard-migrations.mjs` 가 Claude 의 편집을 막는다
- **다시 실행해도 같은 결과.** `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` 를 쓴다
- **권한은 기본값에 기대지 말고 적는다 (v22 부터).** Supabase 는 2026-10-30 부터 public 에 새로 만드는 테이블·시퀀스에
  `anon`·`authenticated`·`service_role` 권한을 자동으로 주지 않는다. 그 전후 어느 쪽에서 돌려도 같은 결과가 나오게 쓴다
  - 새 테이블은 `REVOKE ALL ON <table> FROM anon, authenticated;` 로 시작하고
    `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role;` 를 **반드시** 적는다. 없으면 `createAdminClient()`
    도 42501 이다. 공개 키 경로는 정말 필요할 때만 필요한 권한만 준다(`docs/adr/0013`)
  - IDENTITY·serial 시퀀스는 `GRANT USAGE, SELECT ON SEQUENCE <seq> TO service_role;`
  - 함수는 `EXECUTE` 가 PUBLIC 으로 자동으로 붙는다. service_role 전용 SECURITY DEFINER 함수는 v11 처럼
    `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;` 뒤 `GRANT EXECUTE … TO service_role;`
- **배포와의 순서를 머리 주석에 적는다.** 새 코드가 새 컬럼을 쓰면 코드 배포 **전**, 옛 코드가 쓰던 권한을 걷으면 배포 **후**
- 적용 뒤 `npm run audit:anon` 으로 공개 키 경로를 확인한다
- 투표·투표권·투표 방식을 쓰는 SQL 함수를 바꾸면 `verify-vote-quota` 스킬로 동시성 검사를 돌린다

## 테스트

`__tests__/` 는 SQL 파일 내용을 읽어 확인하는 vitest 다(`npm test` 에 포함). 실제 DB 에 붙지 않는다.
