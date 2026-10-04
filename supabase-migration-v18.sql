-- Plypick v18: 공개 anon 키로 읽던 테이블 여섯 개와 playlists INSERT 를 닫는다
-- Run after supabase-migration-v17.sql.
--
-- 배포 순서: 코드 먼저, SQL 나중.
--   서버 읽기(홈·방 페이지·메트로놈·셋리스트 이미지/PDF·댓글·셋리스트 액션)가 모두
--   service_role 로 옮겨간 코드를 먼저 배포한 뒤 이 파일을 실행한다.
--   이 파일을 먼저 실행하면 세션/공개 키로 읽던 화면이 통째로 빈다.
--
-- 배경
--   NEXT_PUBLIC_SUPABASE_ANON_KEY 는 브라우저에 그대로 노출된다. 아래 여섯 테이블은
--   SELECT USING (true) 라서 그 키만 있으면 누구나 전체 행을 읽을 수 있었다.
--     - playlists         → share_code(= 방 주소) 전체 목록, creator_user_id
--     - playlist_members  → 방별 참여자 user_id·display_name
--     - songs             → 곡 전체, added_by_user_id
--     - comments          → 댓글 전체, user_id
--     - setlist_items     → 셋리스트 전체
--     - song_versions     → 다른 버전 전체, added_by_user_id
--   또 playlists_insert WITH CHECK (true) (supabase-schema.sql:52) 는 이후 어느
--   마이그레이션도 바꾸지 않아서, 공개 키와 세션만 있으면 아무 creator_user_id 를 단
--   합주방을 REST 로 넣을 수 있었다. ADR 0013 "공개 키로는 쓰기 경로를 열지 않는다"와 어긋난다.
--   이미 닫힌 것: votes(v15), playlist_admin(정책 없음), youtube_search_cache(v17).
--
-- 하는 일
--   1) 위 여섯 테이블의 SELECT 정책을 지운다.
--   2) playlists_insert 정책을 지운다.
--   3) v15(votes)·v17(youtube_search_cache)과 같은 방식으로 권한도 회수한다.
--      정책만 지우면 정책이 없는 RLS 는 에러 없이 0행을 돌려줘서 막힌 건지 비어 있는 건지
--      구분이 안 되고, 나중에 누가 USING (true) 정책을 다시 만들면 바로 열린다.
--      권한까지 회수하면 공개 키는 42501(permission denied)을 받는다.
--
-- 하지 않는 일 (그대로 둔다)
--   - songs_insert (auth.uid() = added_by_user_id): addSong 이 세션 클라이언트로 RETURNING 없이 넣는다.
--     INSERT 권한과 정책을 그대로 두므로 SELECT 를 회수해도 동작한다.
--   - comments_insert/update/delete, members_insert/update, setlist_items_insert/update/delete:
--     정책은 남기되 SELECT 가 없으면 UPDATE/DELETE 의 WHERE 와 setlist_items 정책 안의
--     playlists·playlist_members 서브쿼리가 공개 키로는 통과하지 못한다(의도). 앱은 이 쓰기를
--     service_role 로 하거나 SECURITY DEFINER 함수로 한다.
--
-- 앱에 미치는 영향
--   - SECURITY DEFINER 함수(cast_playlist_vote 등)는 소유자 권한으로 돌아 영향이 없다.
--   - 뷰 다섯 개(song_vote_summary, song_voters, song_engagement_counts, playlist_stats, home_stats)는
--     모두 SECURITY DEFINER(기본값, security_invoker 옵션 없음)라 뷰 소유자(= 테이블 소유자) 권한으로
--     테이블을 읽는다. 공개 키의 SELECT 를 회수해도 계속 동작한다. 아래 "적용 확인"의
--     reloptions 가 NULL 인지 한 번 본다.
--   - 실시간은 broadcast 알림이라 테이블 SELECT 와 무관하다(ADR 0010).

-- ============================================================
-- 1. playlists: 조회·직접 생성 차단
-- ============================================================
-- 합주방 생성은 createPlaylist 가 service_role 로 한다.
DROP POLICY IF EXISTS "playlists_select" ON playlists;
DROP POLICY IF EXISTS "playlists_insert" ON playlists;

REVOKE SELECT, INSERT ON playlists FROM anon, authenticated;

-- ============================================================
-- 2. playlist_members: 조회 차단
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON playlist_members;

REVOKE SELECT ON playlist_members FROM anon, authenticated;

-- ============================================================
-- 3. songs: 조회 차단 (songs_insert 는 유지)
-- ============================================================
DROP POLICY IF EXISTS "songs_select" ON songs;

REVOKE SELECT ON songs FROM anon, authenticated;

-- ============================================================
-- 4. comments: 조회 차단
-- ============================================================
DROP POLICY IF EXISTS "comments_select" ON comments;

REVOKE SELECT ON comments FROM anon, authenticated;

-- ============================================================
-- 5. setlist_items: 조회 차단
-- ============================================================
DROP POLICY IF EXISTS "setlist_items_select" ON setlist_items;

REVOKE SELECT ON setlist_items FROM anon, authenticated;

-- ============================================================
-- 6. song_versions: 조회 차단
-- ============================================================
-- added_by_user_id 계정 식별자가 어느 모드에서도 내려가면 안 된다(AGENTS.md).
DROP POLICY IF EXISTS "song_versions_select" ON song_versions;

REVOKE SELECT ON song_versions FROM anon, authenticated;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 남은 공개 SELECT 정책이 없는지. 0건이어야 한다.
--
--   SELECT tablename, policyname, cmd, roles, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('playlists', 'playlist_members', 'songs', 'comments',
--                       'setlist_items', 'song_versions')
--     AND cmd IN ('SELECT', 'ALL');
--
-- 2) 공개 키 권한. select_ok 가 전부 false 여야 하고, playlists 의 insert_ok 도 false 여야 한다.
--    songs 의 insert_ok 는 true 여야 한다(addSong).
--
--   SELECT t AS tablename, r AS role,
--          has_table_privilege(r, 'public.' || t, 'SELECT') AS select_ok,
--          has_table_privilege(r, 'public.' || t, 'INSERT') AS insert_ok
--   FROM unnest(ARRAY['playlists', 'playlist_members', 'songs', 'comments',
--                     'setlist_items', 'song_versions']) AS t,
--        unnest(ARRAY['anon', 'authenticated']) AS r
--   ORDER BY t, r;
--
-- 3) 뷰가 모두 소유자 권한인지. reloptions 가 전부 NULL(= security_invoker 없음)이어야 한다.
--
--   SELECT c.relname, c.reloptions, pg_get_userbyid(c.relowner) AS owner
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public'
--     AND c.relname IN ('song_vote_summary', 'song_voters', 'song_engagement_counts',
--                       'playlist_stats', 'home_stats');
--
-- 4) 마지막으로 공개 키 점검 스크립트를 돌린다.
--
--   npm run audit:anon

-- ============================================================
-- 되돌리기 (화면이 비었을 때만, 약 2분)
-- ============================================================
-- 새 코드는 정책과 무관하게 service_role 로 읽으므로 코드는 그대로 둔다.
-- 아래 블록의 주석을 풀어 실행하면 v18 이전 상태(공개 SELECT 정책 여섯 개 + playlists_insert,
-- 그리고 회수한 권한)가 그대로 돌아온다. 여러 번 실행해도 무해하다.
-- 빠진 읽기 경로를 고쳐 배포한 뒤 이 파일을 다시 실행하고 npm run audit:anon 을 돌린다.
--
-- GRANT SELECT ON playlists, playlist_members, songs, comments, setlist_items, song_versions
--   TO anon, authenticated;
-- GRANT INSERT ON playlists TO anon, authenticated;
--
-- DROP POLICY IF EXISTS "playlists_select" ON playlists;
-- CREATE POLICY "playlists_select" ON playlists FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "playlists_insert" ON playlists;
-- CREATE POLICY "playlists_insert" ON playlists FOR INSERT WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "members_select" ON playlist_members;
-- CREATE POLICY "members_select" ON playlist_members FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "songs_select" ON songs;
-- CREATE POLICY "songs_select" ON songs FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "comments_select" ON comments;
-- CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "setlist_items_select" ON setlist_items;
-- CREATE POLICY "setlist_items_select" ON setlist_items FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "song_versions_select" ON song_versions;
-- CREATE POLICY "song_versions_select" ON song_versions
--   FOR SELECT USING (true);
