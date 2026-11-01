-- Plypick v26: 셋리 블록을 그 자리에 넣고(#6), 순서 저장을 한 번에 한다(#5)
-- Run after supabase/migrations/v25.sql. 코드 배포 **전**에 적용한다. 새 코드는 셋리에 블록을 넣을 때와 순서를 저장할 때
-- 이 두 함수를 rpc 로 부른다. 먼저 배포하면 두 동작이 "function does not exist" 로 실패한다. 옛 코드는 이 함수를
-- 부르지 않으니 먼저 적용해도 무해하다.
--
-- 하는 일
--   insert_setlist_item   p_before_item_id 블록 바로 앞(null 이면 맨 끝)에 새 블록을 넣는다. 그 뒤 블록을 한 칸씩 민다.
--                         지금까지는 화면이 보낸 position 을 그대로 넣거나(인터벌·자작곡) max+1 에 붙여서(곡), 두 사람이
--                         동시에 넣거나 빈자리가 있으면 position 이 겹쳤다. p_before_item_id 블록을 지운 일이 먼저
--                         커밋됐으면 slot_gone 이다. 블록 지우기는 이 잠금 밖이라, 아직 커밋되지 않은 지우기와 겹치면
--                         새 블록은 그 블록이 있던 자리에 들어간다.
--   reorder_setlist_items 전체 순서를 UPDATE 한 번으로 쓴다. 지금까지는 블록마다 UPDATE 를 따로 보내서, 중간에 실패하거나
--                         넣기와 겹치면 position 이 겹쳤다. 화면이 모르는 블록(그 사이 다른 멤버가 넣은 것)은 제자리를
--                         지킨다. 화면의 moveSetlistBlock 이 숨은 블록을 제자리에 두는 규칙과 같다. 그 사이 지워진 id 는 건너뛴다.
--   둘 다 같은 플레이리스트의 셋리 쓰기를 트랜잭션 advisory lock 으로 줄 세우고, 0..n-1 로 다시 매기고, 셋리 전체를
--   돌려준다. 같은 position 은 created_at·id 로 가른다(getSetlistItems 의 정렬과 같다). playlists 행을 잠그지 않아서
--   cast_playlist_vote 의 FOR SHARE(v23)와 부딪히지 않는다.
--   권한(편집 권한·보관된 플레이리스트)은 액션이 먼저 본다. service_role 전용이다(v11 본보기). p_playlist_id 가 null 이면
--   둘 다 playlist_not_found 다.
--
-- 다시 실행해도 무해하다 (CREATE OR REPLACE · REVOKE · GRANT). 데이터를 바꾸지 않는다.

BEGIN;

CREATE OR REPLACE FUNCTION insert_setlist_item(
  p_playlist_id UUID,
  p_before_item_id UUID,
  p_item_type TEXT,
  p_song_id UUID,
  p_label TEXT,
  p_description TEXT,
  p_duration_seconds INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_index INT;
  v_item_id UUID;
BEGIN
  -- setlist_items.playlist_id 는 null 을 받아서, 막지 않으면 어느 플레이리스트에도 보이지 않는 행이 들어간다.
  IF p_playlist_id IS NULL THEN
    RAISE EXCEPTION 'playlist_not_found';
  END IF;
  IF p_item_type IS NULL OR p_item_type NOT IN ('song', 'interval', 'original') THEN
    RAISE EXCEPTION 'invalid_block';
  END IF;
  IF p_item_type <> 'song' AND (p_label IS NULL OR p_duration_seconds IS NULL OR p_duration_seconds < 0) THEN
    RAISE EXCEPTION 'invalid_block';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('setlist_items:' || p_playlist_id::TEXT, 0));

  IF p_item_type = 'song' AND NOT EXISTS (
    SELECT 1 FROM songs WHERE id = p_song_id AND playlist_id = p_playlist_id
  ) THEN
    RAISE EXCEPTION 'song_not_found';
  END IF;

  IF p_before_item_id IS NULL THEN
    SELECT count(*)::INT INTO v_index FROM setlist_items WHERE playlist_id = p_playlist_id;
  ELSE
    SELECT o.idx INTO v_index
    FROM (
      SELECT id, (row_number() OVER (ORDER BY position, created_at, id) - 1)::INT AS idx
      FROM setlist_items
      WHERE playlist_id = p_playlist_id
    ) o
    WHERE o.id = p_before_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'slot_gone';
    END IF;
  END IF;

  UPDATE setlist_items s
  SET position = o.idx + CASE WHEN o.idx >= v_index THEN 1 ELSE 0 END
  FROM (
    SELECT id, (row_number() OVER (ORDER BY position, created_at, id) - 1)::INT AS idx
    FROM setlist_items
    WHERE playlist_id = p_playlist_id
  ) o
  WHERE s.id = o.id
    AND s.position <> o.idx + CASE WHEN o.idx >= v_index THEN 1 ELSE 0 END;

  INSERT INTO setlist_items (playlist_id, position, item_type, song_id, label, description, duration_seconds)
  VALUES (
    p_playlist_id,
    v_index,
    p_item_type,
    CASE WHEN p_item_type = 'song' THEN p_song_id END,
    CASE WHEN p_item_type <> 'song' THEN p_label END,
    CASE WHEN p_item_type <> 'song' THEN p_description END,
    CASE WHEN p_item_type = 'song' THEN 0 ELSE p_duration_seconds END
  )
  RETURNING id INTO v_item_id;

  RETURN jsonb_build_object(
    'item_id', v_item_id,
    'items', (
      SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position, s.created_at, s.id), '[]'::JSONB)
      FROM setlist_items s
      WHERE s.playlist_id = p_playlist_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION reorder_setlist_items(
  p_playlist_id UUID,
  p_item_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- null 은 어느 행과도 맞지 않아서, 막지 않으면 저장한 것처럼 빈 셋리를 돌려준다.
  IF p_playlist_id IS NULL THEN
    RAISE EXCEPTION 'playlist_not_found';
  END IF;
  IF p_item_ids IS NULL OR cardinality(p_item_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_item_ids) AS x) THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('setlist_items:' || p_playlist_id::TEXT, 0));

  -- 보낸 블록은 그 블록들이 지금 차지한 칸을 보낸 순서대로 채우고, 보내지 않은 블록은 지금 칸에 남는다.
  WITH cur AS (
    SELECT id, (row_number() OVER (ORDER BY position, created_at, id) - 1)::INT AS idx
    FROM setlist_items
    WHERE playlist_id = p_playlist_id
  ),
  sent AS (
    SELECT t.id, row_number() OVER (ORDER BY t.ord) AS k
    FROM unnest(p_item_ids) WITH ORDINALITY AS t(id, ord)
    JOIN cur ON cur.id = t.id
  ),
  slot AS (
    SELECT idx, row_number() OVER (ORDER BY idx) AS k
    FROM cur
    WHERE id IN (SELECT id FROM sent)
  ),
  target AS (
    SELECT sent.id, slot.idx FROM sent JOIN slot ON slot.k = sent.k
    UNION ALL
    SELECT cur.id, cur.idx FROM cur WHERE cur.id NOT IN (SELECT id FROM sent)
  )
  UPDATE setlist_items s
  SET position = target.idx
  FROM target
  WHERE s.id = target.id
    AND s.position IS DISTINCT FROM target.idx;

  RETURN jsonb_build_object(
    'items', (
      SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position, s.created_at, s.id), '[]'::JSONB)
      FROM setlist_items s
      WHERE s.playlist_id = p_playlist_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION insert_setlist_item(UUID, UUID, TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_setlist_item(UUID, UUID, TEXT, UUID, TEXT, TEXT, INT) TO service_role;
REVOKE ALL ON FUNCTION reorder_setlist_items(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reorder_setlist_items(UUID, UUID[]) TO service_role;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) 실행 권한. 기대값: anon f f, authenticated f f, service_role t t
--
--   SELECT r,
--          has_function_privilege(r, 'insert_setlist_item(uuid,uuid,text,uuid,text,text,integer)', 'EXECUTE') AS can_insert,
--          has_function_privilege(r, 'reorder_setlist_items(uuid,uuid[])', 'EXECUTE') AS can_reorder
--   FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r;
--
-- 2) 데이터를 바꾸지 않았다. 기대값: 적용 전후 같은 행 수
--
--   SELECT count(*) FROM setlist_items;
--
-- 3) npm run audit:anon 이 두 함수를 "권한 거부 42501" 로 통과한다.

-- ============================================================
-- 되돌리기 (먼저 옛 코드로 되돌린 뒤)
-- ============================================================
-- DROP FUNCTION IF EXISTS insert_setlist_item(UUID, UUID, TEXT, UUID, TEXT, TEXT, INT);
-- DROP FUNCTION IF EXISTS reorder_setlist_items(UUID, UUID[]);
