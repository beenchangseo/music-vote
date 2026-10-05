-- Plypick v20: 앱이 쓰지 않는 공개 키 쓰기 권한을 회수한다
-- Run after supabase-migration-v19.sql. 순서 무관(코드와 독립) — 앱 코드는 바뀌지 않는다.
--
-- 배경
--   v18 이 여섯 테이블의 SELECT 와 playlists INSERT 를 닫았다. 그런데 Supabase 는 public 스키마
--   테이블에 anon·authenticated 의 INSERT·UPDATE·DELETE 권한을 기본으로 준다. 지금 이 쓰기를
--   막고 있는 것은 (1) SELECT 가 없어 WHERE 를 못 쓰는 것과 (2) Supabase 의 "WHERE 없는 UPDATE 금지"
--   (21000) 뿐이다. 실제로 v18 이전에는 로그인한 사용자가 자기 playlist_members.vote_limit 을
--   REST 로 직접 올릴 수 있었다(members_update 정책 = auth.uid() = user_id, 컬럼 UPDATE 권한 있음).
--   2026-10-05 확인: 지금은 조건 있는 UPDATE 42501, 조건 없는 UPDATE 21000 으로 막혀 있다.
--   정책을 다시 열거나 SELECT 를 다시 주는 순간 열리는 구조라, 앱이 쓰지 않는 권한을 회수해 둔다.
--
-- 앱이 공개 키(세션 클라이언트)로 하는 쓰기는 두 가지뿐이다 (2026-10-05 코드 기준)
--   - songs INSERT       src/actions/song.ts addSong       (songs_insert: auth.uid() = added_by_user_id)
--   - comments INSERT    src/actions/comment.ts 새 댓글    (comments_insert: auth.uid() = user_id)
--   나머지 쓰기는 service_role(createAdminClient) 이나 SECURITY DEFINER 함수다:
--   cast_playlist_vote, register_playlist_member, configure_playlist_voting, set_member_vote_limit,
--   apply_vote_limit_to_all, save_playlist_voting_settings (전부 SECURITY DEFINER, v10~v12).
--   SECURITY DEFINER 함수와 service_role 은 이 회수의 영향을 받지 않는다.
--
-- 하는 일
--   1) playlist_members·setlist_items·song_versions: 공개 키의 INSERT·UPDATE·DELETE 회수
--   2) songs·comments: UPDATE·DELETE 회수, anon 의 INSERT 회수 (authenticated INSERT 는 유지)
--   3) playlists: 남은 UPDATE·DELETE 회수 (v18 이 SELECT·INSERT 는 이미 회수)
--   정책은 지우지 않는다. 권한이 없으면 정책에 닿지 않으므로, 나중에 권한을 되돌릴 때 동작이 같다.
--
-- 다시 실행해도 무해하다 (REVOKE 는 멱등). 데이터를 바꾸지 않는다.

REVOKE INSERT, UPDATE, DELETE ON playlist_members FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON setlist_items    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON song_versions    FROM anon, authenticated;

REVOKE UPDATE, DELETE ON songs    FROM anon, authenticated;
REVOKE UPDATE, DELETE ON comments FROM anon, authenticated;
REVOKE INSERT ON songs, comments FROM anon;

REVOKE UPDATE, DELETE ON playlists FROM anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 공개 키 쓰기 권한. authenticated 의 songs·comments INSERT 만 true 여야 한다.
--
--   SELECT t AS tablename, r AS role,
--          has_table_privilege(r, 'public.' || t, 'INSERT') AS insert_ok,
--          has_table_privilege(r, 'public.' || t, 'UPDATE') AS update_ok,
--          has_table_privilege(r, 'public.' || t, 'DELETE') AS delete_ok
--   FROM unnest(ARRAY['playlists', 'playlist_members', 'songs', 'comments',
--                     'setlist_items', 'song_versions']) AS t,
--        unnest(ARRAY['anon', 'authenticated']) AS r
--   ORDER BY t, r;
--
-- 그다음 npm run audit:anon, 그리고 로컬 게이트 npm run test:e2e (곡·댓글 쓰기 경로 확인).

-- ============================================================
-- 되돌리기
-- ============================================================
-- 앱 동작이 바뀌지 않으므로 보통 필요 없다. 필요하면 주석을 풀어 실행한다.
--
-- GRANT INSERT, UPDATE, DELETE ON playlist_members, setlist_items, song_versions TO anon, authenticated;
-- GRANT UPDATE, DELETE ON songs, comments, playlists TO anon, authenticated;
-- GRANT INSERT ON songs, comments TO anon;
