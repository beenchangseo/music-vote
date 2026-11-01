-- Plypick v27: 셋리스트 확정을 v26 잠금 안에서 한다. 빈 셋리만 상위 곡으로 채운다 (#44)
-- Run after supabase/migrations/v26.sql. 코드 배포 **전**에 적용한다. 새 코드는 셋리스트를 확정할 때(방장의 확정 버튼,
-- 자동 확정 크론) 이 함수를 rpc 로 부른다. 먼저 배포하면 두 확정이 "function does not exist" 로 실패한다. 옛 코드는 이
-- 함수를 부르지 않으니 먼저 적용해도 무해하다.
--
-- 하는 일
--   confirm_setlist  셋리가 비어 있으면 p_song_ids 를 그 순서대로 0..n-1 곡 블록으로 넣고 setlist_confirmed 를 켠다.
--                    블록이 이미 있으면 아무것도 넣지 않고 지금 셋리 그대로 setlist_confirmed 만 켠다. 크론이 쓰던
--                    "사용자가 손댔을 수 있음" 규칙과 같고, 방장의 확정 버튼도 이제 이 규칙이다(2026-11-01 운영자 결정).
--                    이미 확정된 플레이리스트면 아무것도 쓰지 않는다. 셋 다 셋리 전체를 돌려준다. 그래서 두 번 눌러도,
--                    크론과 방장이 겹쳐도 끝 상태가 같다.
--                    지금까지는 액션과 크론이 잠금 밖에서 0..n-1 을 그대로 넣어서, insert_setlist_item·
--                    reorder_setlist_items(v26)와 겹치면 position 이 겹쳤고, 블록이 이미 있는 셋리에 손으로 확정하면
--                    같은 곡이 한 번 더 붙었다. 크론은 확정 표시를 켜지 못하면 그 플레이리스트의 블록을 모두 지워서,
--                    그 사이 다른 멤버가 넣은 블록까지 지웠다. 이제 블록 확인·넣기·확정 표시가 같은 잠금 안의 한
--                    트랜잭션이다.
--                    insert_setlist_item 과 같은 advisory lock 으로 줄을 서고, 셋리를 같은 정렬로 돌려준다. 넣을 곡이
--                    이 플레이리스트의 후보곡이 아니면 song_not_found 이고 아무것도 쓰지 않는다. 넣지 않는 두 경우는
--                    p_song_ids 를 보지 않는다. 권한(방장·보관된 플레이리스트)은 액션이 먼저 본다. service_role
--                    전용이다(v11 본보기).
--
-- 다시 실행해도 무해하다 (CREATE OR REPLACE · REVOKE · GRANT). 데이터를 바꾸지 않는다.

BEGIN;

CREATE OR REPLACE FUNCTION confirm_setlist(
  p_playlist_id UUID,
  p_song_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed BOOLEAN;
BEGIN
  IF p_playlist_id IS NULL THEN
    RAISE EXCEPTION 'playlist_not_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('setlist_items:' || p_playlist_id::TEXT, 0));

  SELECT coalesce(setlist_confirmed, false) INTO v_confirmed FROM playlists WHERE id = p_playlist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'playlist_not_found';
  END IF;

  IF NOT v_confirmed THEN
    IF NOT EXISTS (SELECT 1 FROM setlist_items WHERE playlist_id = p_playlist_id) THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_song_ids) AS t(id)
        WHERE NOT EXISTS (SELECT 1 FROM songs WHERE songs.id = t.id AND songs.playlist_id = p_playlist_id)
      ) THEN
        RAISE EXCEPTION 'song_not_found';
      END IF;

      INSERT INTO setlist_items (playlist_id, position, item_type, song_id, duration_seconds)
      SELECT p_playlist_id, (t.ord - 1)::INT, 'song', t.id, 0
      FROM unnest(p_song_ids) WITH ORDINALITY AS t(id, ord);
    END IF;

    UPDATE playlists SET setlist_confirmed = true WHERE id = p_playlist_id;
  END IF;

  RETURN jsonb_build_object(
    'items', (
      SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position, s.created_at, s.id), '[]'::JSONB)
      FROM setlist_items s
      WHERE s.playlist_id = p_playlist_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_setlist(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_setlist(UUID, UUID[]) TO service_role;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 실행 권한. 기대값: anon f, authenticated f, service_role t
--
--   SELECT r, has_function_privilege(r, 'confirm_setlist(uuid,uuid[])', 'EXECUTE') AS can_confirm
--   FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r;
--
-- 2) 데이터를 바꾸지 않았다. 기대값: 적용 전후 같은 값
--
--   SELECT (SELECT count(*) FROM setlist_items) AS items,
--          (SELECT count(*) FROM playlists WHERE setlist_confirmed) AS confirmed;
--
-- 3) npm run audit:anon 이 confirm_setlist 를 "권한 거부 42501" 로 통과한다.

-- ============================================================
-- 되돌리기 (먼저 옛 코드로 되돌린 뒤)
-- ============================================================
-- DROP FUNCTION IF EXISTS confirm_setlist(UUID, UUID[]);
