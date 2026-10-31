-- Plypick v24: 투표 마감이 지난 플레이리스트의 표를 서버가 거부한다
-- Run after supabase/migrations/v23.sql. 코드 배포 후에 적용한다. 새 코드는 이 함수가 내는 마감 오류를 "투표가
-- 마감됐어요" 로 보여 주고, 옛 코드는 같은 오류를 일반 실패("투표에 실패했어요")로 보여 준다. 순서를 바꿔도 데이터는
-- 상하지 않는다. 배포와 적용 사이에는 문구만 다르거나(먼저 적용), 마감 뒤 표가 지금처럼 들어간다(먼저 배포).
--
-- 하는 일
--   cast_playlist_vote 가 playlists.deadline 이 지난 플레이리스트의 표를 거부한다 (#24). 화면은 마감 뒤 투표 버튼을
--   막지만 서버는 마감을 보지 않아서, 마감 전에 연 화면이나 RPC 직접 호출로 표가 계속 들어갔고, 셋리 자동 확정
--   크론이 읽는 순위와 어긋날 수 있었다. 이 함수는 authenticated 가 PostgREST 로 바로 부를 수 있으므로 Server
--   Action 이 아니라 여기서 막는다.
--   경계는 크론(.lt("deadline", now))·화면(new Date(deadline) < new Date())과 같아서, 마감 시각 정각까지는 받는다.
--   v23 의 락과 실행 권한은 그대로다.
--
-- 다시 실행해도 무해하다 (CREATE OR REPLACE · GRANT). 데이터를 바꾸지 않는다.

BEGIN;

CREATE OR REPLACE FUNCTION cast_playlist_vote(
  p_song_id UUID,
  p_vote_type SMALLINT,
  p_nickname TEXT
)
RETURNS TABLE (
  result TEXT,
  used_votes INT,
  vote_limit SMALLINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_playlist_id UUID;
  v_mode TEXT;
  v_deadline TIMESTAMPTZ;
  v_limit SMALLINT;
  v_existing_id UUID;
  v_existing_type SMALLINT;
  v_used INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF p_vote_type NOT IN (1, -1) THEN
    RAISE EXCEPTION '잘못된 투표 값입니다.';
  END IF;

  -- 방식을 바꾸는 쪽(FOR UPDATE)이 이 표의 커밋을 기다리게 해서, 여기서 읽은 방식이 표를 넣을 때까지 유지된다.
  SELECT s.playlist_id, p.voting_mode, p.deadline
    INTO v_playlist_id, v_mode, v_deadline
  FROM songs s
  JOIN playlists p ON p.id = s.playlist_id
  WHERE s.id = p_song_id
  FOR SHARE OF p;

  IF v_playlist_id IS NULL THEN
    RAISE EXCEPTION '곡을 찾을 수 없습니다.';
  END IF;

  IF v_deadline IS NOT NULL AND v_deadline < transaction_timestamp() THEN
    RAISE EXCEPTION '투표가 마감되었습니다.';
  END IF;

  PERFORM register_playlist_member(v_playlist_id);

  -- 같은 참여자의 동시 클릭을 직렬화해 투표권 초과를 막는다.
  SELECT pm.vote_limit
    INTO v_limit
  FROM playlist_members pm
  WHERE pm.playlist_id = v_playlist_id AND pm.user_id = v_user_id
  FOR UPDATE;

  SELECT v.id, v.vote_type
    INTO v_existing_id, v_existing_type
  FROM votes v
  WHERE v.song_id = p_song_id AND v.user_id = v_user_id
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT 1;

  IF v_mode = 'allocated' THEN
    IF v_existing_id IS NOT NULL AND v_existing_type <> p_vote_type THEN
      -- 반대 방향 클릭은 기존 방향의 표를 한 개만 취소한다.
      DELETE FROM votes WHERE id = v_existing_id;
      result := 'removed';
    ELSE
      SELECT count(*)::INT
        INTO v_used
      FROM votes v
      JOIN songs s ON s.id = v.song_id
      WHERE s.playlist_id = v_playlist_id AND v.user_id = v_user_id;

      IF v_used >= v_limit THEN
        RAISE EXCEPTION '투표권을 모두 사용했습니다.';
      END IF;

      -- 같은 방향을 반복해서 누르면 한 행씩 추가한다.
      INSERT INTO votes (song_id, user_id, nickname, vote_type)
      VALUES (p_song_id, v_user_id, p_nickname, p_vote_type);
      result := 'added';
    END IF;
  ELSIF v_existing_id IS NOT NULL THEN
    -- 자유 투표는 기존 후보곡당 1표 토글 동작을 유지한다.
    IF v_existing_type = p_vote_type THEN
      DELETE FROM votes WHERE id = v_existing_id;
      result := 'removed';
    ELSE
      UPDATE votes SET vote_type = p_vote_type WHERE id = v_existing_id;
      result := 'changed';
    END IF;
  ELSE
    INSERT INTO votes (song_id, user_id, nickname, vote_type)
    VALUES (p_song_id, v_user_id, p_nickname, p_vote_type);
    result := 'added';
  END IF;

  SELECT count(*)::INT
    INTO used_votes
  FROM votes v
  JOIN songs s ON s.id = v.song_id
  WHERE s.playlist_id = v_playlist_id AND v.user_id = v_user_id;

  vote_limit := v_limit;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION cast_playlist_vote(UUID, SMALLINT, TEXT) TO authenticated;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) cast_playlist_vote 가 v24 정의다. 둘 다 true 여야 한다.
--
--   SELECT prosrc LIKE '%FOR SHARE OF p%' AS cast_locks_mode,
--          prosrc LIKE '%v_deadline < transaction_timestamp()%' AS cast_checks_deadline
--   FROM pg_proc WHERE proname = 'cast_playlist_vote';
--
-- 2) 실행 권한은 v23 그대로다. cast_playlist_vote 는 authenticated true (나머지 역할은 이 마이그레이션이 바꾸지
--    않는다), v23 이 걷은 세 함수는 네 역할 모두 false.
--
--   SELECT f AS fn, r AS role, has_function_privilege(r, f, 'EXECUTE') AS can_execute
--   FROM unnest(ARRAY['cast_playlist_vote(uuid,smallint,text)',
--                     'configure_playlist_voting(uuid,text,smallint)',
--                     'set_member_vote_limit(uuid,uuid,smallint)',
--                     'apply_vote_limit_to_all(uuid,smallint)']) AS f,
--        unnest(ARRAY['public', 'anon', 'authenticated', 'service_role']) AS r
--   ORDER BY f, r;
--
-- 3) 마감 뒤에 들어간 표의 수. 적용 직후 값을 적어 두고, 마감이 지나는 플레이리스트가 생긴 뒤 다시 돌려 늘지 않았는지
--    본다. 이미 있는 값은 이 수정 전에 들어간 표다.
--
--   SELECT count(*) AS votes_after_deadline
--   FROM votes v
--   JOIN songs s ON s.id = v.song_id
--   JOIN playlists p ON p.id = s.playlist_id
--   WHERE p.deadline IS NOT NULL AND v.created_at > p.deadline;

-- ============================================================
-- 되돌리기
-- ============================================================
-- supabase/migrations/v23.sql 을 다시 실행한다. 다시 실행해도 무해하게 쓰여 있다.
