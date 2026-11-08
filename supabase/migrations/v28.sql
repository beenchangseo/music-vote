-- Plypick v28: 로그인 세션이 songs 에 바로 넣는 길을 닫는다
-- Run after supabase/migrations/v27.sql. 코드 배포 **후**에 적용한다. 새 addSong 은 마감·보관을 검사한 뒤 service_role 로
-- 넣어서 이 회수와 상관없이 동작한다. 먼저 적용하면 옛 addSong(세션 클라이언트)이 42501 로 실패해, 배포될 때까지 아무도
-- 곡을 추가하지 못한다.
--
-- 배경 (#88)
--   v15 의 songs_insert(auth.uid() = added_by_user_id) 와 v18·v20 이 남긴 authenticated 의 INSERT 권한 때문에, 카카오로
--   로그인한 누구나 자기 세션 토큰과 공개 키로 PostgREST 에 곡을 바로 넣을 수 있었다. 정책은 등록자 칸만 보므로 마감이
--   지난 플레이리스트에도, 보관된 플레이리스트에도 들어가고, 제목·썸네일 같은 열도 마음대로 채운다. 마감 뒤에 들어간
--   곡은 셋리 자동 확정 크론의 상위 N곡에 섞일 수 있다. 투표는 v24 가 cast_playlist_vote 안에서 막았다.
--
-- 하는 일
--   1) anon·authenticated 의 songs INSERT 를 회수한다. anon 은 v20 이 이미 걷었고 다시 적어도 무해하다.
--      곡 등록은 마감·보관 검사를 마친 addSong 이 service_role 로만 한다(docs/adr/0013).
--   2) service_role 의 songs INSERT 를 적어 둔다. 권한을 기본값에 기대지 않는다(v22 부터, supabase/README.md).
--   songs_insert 정책은 v20 처럼 지우지 않는다. 권한이 없으면 정책에 닿지 않는다.
--
-- 다시 실행해도 무해하다 (REVOKE·GRANT 는 멱등). 데이터를 바꾸지 않는다.

BEGIN;

REVOKE INSERT ON songs FROM anon, authenticated;
GRANT INSERT ON songs TO service_role;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) songs INSERT 는 service_role 만 true 다. anon·authenticated 는 false.
--
--   SELECT r AS role, has_table_privilege(r, 'public.songs', 'INSERT') AS insert_ok
--   FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
--   ORDER BY r;
--
-- 2) 마감 뒤에 들어간 곡의 수. 적용 직후 값을 적어 두고, 마감이 지나는 플레이리스트가 생긴 뒤 다시 돌려 늘지 않았는지
--    본다. 이미 있는 값은 이 수정 전에 들어간 곡이다.
--
--   SELECT count(*) AS songs_after_deadline
--   FROM songs s
--   JOIN playlists p ON p.id = s.playlist_id
--   WHERE p.deadline IS NOT NULL AND s.created_at > p.deadline;
--
-- 그다음 npm run audit:anon.

-- ============================================================
-- 되돌리기
-- ============================================================
-- 새 addSong 은 service_role 로 넣으므로 되돌려도 앱 동작은 같다. 공개 키 경로만 다시 열린다.
--
-- GRANT INSERT ON songs TO authenticated;
