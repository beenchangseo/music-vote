-- Plypick v23: 처리 중인 표와 투표 설정 변경의 경쟁을 막는다
-- Run after supabase/migrations/v22.sql. 코드 배포와 무관하다. 함수 이름·인자·반환 모양이 그대로고, 실행 권한을
-- 걷는 세 함수는 앱이 2026-10-31(PR #17)부터 부르지 않는다. 배포 전후 어느 쪽에 적용해도 지금 코드가 그대로 돈다.
--
-- 하는 일
--   1) cast_playlist_vote: voting_mode 를 읽는 조회가 playlists 행을 FOR SHARE 로 잠근다 (#16, #15).
--      v12 는 락 없이 읽어서, 그사이 방장이 방식을 바꾸면 표가 예전 방식의 규칙으로 들어갔다(자유 → 할당이면
--      한도 검사 없이). 설정 저장과 configure 는 같은 행을 FOR UPDATE 로 잡으므로, 이제 처리 중인 표가 커밋될
--      때까지 기다렸다가 그 표를 센다. 표가 있으면 방식 변경을 거부하고, 한도를 줄일 때도 그 표를 놓치지 않는다
--      (#15 의 save_playlist_voting_settings 경로). 투표끼리는 FOR SHARE 가 서로 막지 않으므로, 표가 계속 겹쳐
--      들어오면 설정 저장은 그 표들이 모두 커밋될 때까지 기다린다(밴드 규모에서는 ms 단위로 본다, 측정하지 않음).
--   2) configure_playlist_voting · set_member_vote_limit · apply_vote_limit_to_all: 모든 API 역할의 실행 권한을
--      걷는다 (#15). 뒤의 둘은 멤버의 표를 락 없이 세고 나중에 UPDATE 해서, 방장이 RPC 로 직접 부르면 표가
--      한도를 넘은 채로 남을 수 있었다. 앱은 셋 다 부르지 않는다. service_role 도 걷는다. 셋 다
--      creator_user_id = auth.uid() 로 방장을 확인해서 service_role 키로는 쓸 데가 없고, 권한이 없어야 누가 다시
--      부를 때 #15 를 조용히 되살리는 대신 42501 로 드러난다.
--
-- save_playlist_voting_settings 는 다시 정의하지 않는다. 처음부터 playlists 행을 FOR UPDATE 로 잡고 커밋까지
-- 들고 있어서, 1) 뒤에는 투표와 겹쳐 돌 수 없다. 멤버 행을 더 잠가도 막는 실행 순서가 없다(모델로 확인).
-- 락 순서는 투표·설정 저장·configure 모두 playlists → playlist_members 라 교착이 생기지 않는다.
-- 동시성 검사: verification/vote-quota/check.sh (.claude/skills/verify-vote-quota/SKILL.md).
--
-- 다시 실행해도 무해하다 (CREATE OR REPLACE · GRANT · REVOKE). 데이터를 바꾸지 않는다.

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
  SELECT s.playlist_id, p.voting_mode
    INTO v_playlist_id, v_mode
  FROM songs s
  JOIN playlists p ON p.id = s.playlist_id
  WHERE s.id = p_song_id
  FOR SHARE OF p;

  IF v_playlist_id IS NULL THEN
    RAISE EXCEPTION '곡을 찾을 수 없습니다.';
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

REVOKE ALL ON FUNCTION configure_playlist_voting(UUID, TEXT, SMALLINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION set_member_vote_limit(UUID, UUID, SMALLINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION apply_vote_limit_to_all(UUID, SMALLINT) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) cast_playlist_vote 가 v23 정의다. true 여야 한다.
--
--   SELECT prosrc LIKE '%FOR SHARE OF p%' AS cast_locks_mode
--   FROM pg_proc WHERE proname = 'cast_playlist_vote';
--
-- 2) 실행 권한. 기대값:
--    configure_playlist_voting · set_member_vote_limit · apply_vote_limit_to_all  네 역할 모두 false
--    cast_playlist_vote             authenticated true (나머지는 이 마이그레이션이 바꾸지 않는다)
--    save_playlist_voting_settings  service_role 만 true (v11 그대로)
--
--   SELECT f AS fn, r AS role, has_function_privilege(r, f, 'EXECUTE') AS can_execute
--   FROM unnest(ARRAY['cast_playlist_vote(uuid,smallint,text)',
--                     'save_playlist_voting_settings(uuid,boolean,text,smallint,jsonb)',
--                     'configure_playlist_voting(uuid,text,smallint)',
--                     'set_member_vote_limit(uuid,uuid,smallint)',
--                     'apply_vote_limit_to_all(uuid,smallint)']) AS f,
--        unnest(ARRAY['public', 'anon', 'authenticated', 'service_role']) AS r
--   ORDER BY f, r;
--
-- 그다음 npm run audit:anon.

-- ============================================================
-- 되돌리기
-- ============================================================
-- 실행 권한만 되돌릴 때 (앱은 이 셋을 부르지 않는다. 다시 열면 #15 가 돌아온다):
--
-- GRANT EXECUTE ON FUNCTION configure_playlist_voting(UUID, TEXT, SMALLINT) TO authenticated;
-- GRANT EXECUTE ON FUNCTION set_member_vote_limit(UUID, UUID, SMALLINT) TO authenticated;
-- GRANT EXECUTE ON FUNCTION apply_vote_limit_to_all(UUID, SMALLINT) TO authenticated;
--
-- cast_playlist_vote 를 v12 정의로 되돌리려면 supabase/migrations/v12.sql 의 CREATE OR REPLACE 를 다시 실행한다.
