-- Plypick v19: 밴드(팀) — teams, team_members, playlists.team_id
-- Run after supabase-migration-v18.sql.
--
-- 배포 순서: SQL 먼저, 코드 나중.
--   새 코드는 playlists.team_id·team_linked_via 와 teams·team_members 를 읽고 쓴다.
--   코드가 먼저 나가면 컬럼이 없어 방 조회가 실패한다. 이 파일을 먼저 실행한 뒤 배포한다.
--   옛 코드는 새 테이블·컬럼을 모르므로 SQL 만 먼저 돌아도 아무것도 깨지지 않는다.
--
-- 배경 (docs/plans/2026-09-21-teams-and-shared-catalog.md "구현 범위 — CEO 리뷰 재결정", ADR 0014)
--   코드·DB 에서는 team, 화면에서는 "밴드"라고 부른다.
--   밴드는 합주방 위에 얕게 얹는다. 방의 RLS·투표 함수(v10)는 건드리지 않고
--   playlists 에 nullable team_id 하나만 더한다. 방장 권한·투표권은 지금처럼 방 단위다.
--
-- 보안
--   teams·team_members 는 닫힌 채로 태어난다(v17 youtube_search_cache 와 같은 방식).
--   RLS 를 켜고 정책을 만들지 않으며, 공개 키(anon·authenticated)의 권한을 모두 회수한다.
--   읽기·쓰기 모두 서버 액션이 service_role 로 하고, 권한(owner·member·방장)은 코드가 검사한다.
--   playlists 는 v15 가 UPDATE 정책을, v18 이 SELECT·INSERT 를 닫았으므로 새 컬럼도 공개 키로는 못 쓴다.
--
-- 하는 일
--   1) teams: 밴드 이름, 초대 코드(nanoid 10자, 유일), 만든 사람, 다음 공연 날짜(E2)
--   2) team_members: 밴드 멤버. 역할은 owner(밴드당 1명) | member. 이름은 가입 시점 카카오 닉네임
--   3) playlists.team_id: 방이 속한 밴드. 밴드를 지우면 방은 팀 없는 방으로 돌아간다(SET NULL)
--   4) playlists.team_linked_via: 방이 밴드에 들어온 경로. 성공 지표 "밴드에서 만든 새 방" 을 가른다
--        promote = 이 방에서 "이 멤버로 밴드 만들기"로 밴드를 만들었다
--        band    = 밴드 홈의 "새 합주방"으로 만들었다
--        attach  = 이미 있던 방을 밴드에 넣었다
--      팀 없는 방은 NULL. 서버 액션이 team_id 와 같은 쓰기에서 함께 넣는다
--   5) 인덱스: 홈 "내 합주방"의 팀 방 집합(playlists.team_id, team_members.user_id),
--      E4 키·BPM 이어받기(songs.youtube_video_id)
--
-- 다시 실행해도 무해하다 (IF NOT EXISTS). 데이터를 바꾸지 않는다.

-- ============================================================
-- 1. teams
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  -- 초대 링크 /join/{invite_code}. 링크를 새로 만들면 바뀌고 옛 코드는 죽는다.
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 다음 공연 날짜 (KST 달력 날짜). 지난 날짜는 화면에서만 숨기고 값은 둔다.
  next_show_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. team_members
-- ============================================================
-- user_id 는 playlist_members(v7) 와 같은 규칙: 계정이 지워지면 멤버 행도 지운다.
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ============================================================
-- 3·4. playlists: 팀 연결
-- ============================================================
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS team_id UUID
    REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS team_linked_via TEXT
    CHECK (team_linked_via IN ('promote', 'band', 'attach'));

-- ============================================================
-- 5. 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_playlists_team
  ON playlists(team_id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_songs_youtube_video
  ON songs(youtube_video_id);

-- ============================================================
-- 6. 공개 키 차단
-- ============================================================
-- Supabase 는 public 스키마의 새 테이블에 anon·authenticated 권한을 기본으로 준다.
-- 정책 없는 RLS 만으로도 0행이 되지만, 권한까지 회수해 42501 이 돌아오게 한다(v15·v17·v18 과 같음).
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON teams FROM anon, authenticated;
REVOKE ALL ON team_members FROM anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 공개 키 권한. 전부 false 여야 한다.
--
--   SELECT t AS tablename, r AS role,
--          has_table_privilege(r, 'public.' || t, 'SELECT') AS select_ok,
--          has_table_privilege(r, 'public.' || t, 'INSERT') AS insert_ok,
--          has_table_privilege(r, 'public.' || t, 'UPDATE') AS update_ok,
--          has_table_privilege(r, 'public.' || t, 'DELETE') AS delete_ok
--   FROM unnest(ARRAY['teams', 'team_members']) AS t,
--        unnest(ARRAY['anon', 'authenticated']) AS r
--   ORDER BY t, r;
--
-- 2) 정책이 없는지. 0건이어야 한다.
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('teams', 'team_members');
--
-- 3) 새 컬럼. 둘 다 있어야 한다.
--
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'playlists'
--     AND column_name IN ('team_id', 'team_linked_via');
--
-- 4) 공개 키 점검 스크립트. "v19 이후에 생기는 것" 의 teams·team_members 가 통과해야 한다.
--
--   npm run audit:anon

-- ============================================================
-- 되돌리기
-- ============================================================
-- 먼저 코드를 직전 배포로 되돌린다(vercel rollback). 새 코드가 떠 있는 채로 컬럼을 지우면 방 조회가 실패한다.
-- 테이블·컬럼은 추가만 했으므로 옛 코드 아래에서는 그대로 둬도 무해하다. 정말 지워야 할 때만
-- 아래 주석을 풀어 실행한다. 밴드·멤버·방의 팀 연결 데이터가 모두 사라지고 되살릴 수 없다.
--
-- 잘못 만든 밴드 하나만 정리할 때는 이 블록이 아니라 그 teams 행만 지운다:
--   DELETE FROM teams WHERE id = '...';   -- team_members 는 CASCADE, playlists.team_id 는 SET NULL
--
-- DROP INDEX IF EXISTS idx_songs_youtube_video;
-- DROP INDEX IF EXISTS idx_team_members_user;
-- DROP INDEX IF EXISTS idx_playlists_team;
-- ALTER TABLE playlists DROP COLUMN IF EXISTS team_linked_via;
-- ALTER TABLE playlists DROP COLUMN IF EXISTS team_id;
-- DROP TABLE IF EXISTS team_members;
-- DROP TABLE IF EXISTS teams;
