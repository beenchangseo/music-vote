-- Plypick v12: 할당 모드에서 한 후보곡에 중복 투표
-- Run after supabase-migration-v11.sql.

-- 로그인 참여자의 후보곡당 1행 제약을 제거하고 반복 투표 조회용 인덱스로 교체한다.
DROP INDEX IF EXISTS uq_votes_song_user;

CREATE INDEX IF NOT EXISTS idx_votes_song_user_type
  ON votes(song_id, user_id, vote_type)
  WHERE user_id IS NOT NULL;

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

  SELECT s.playlist_id, p.voting_mode
    INTO v_playlist_id, v_mode
  FROM songs s
  JOIN playlists p ON p.id = s.playlist_id
  WHERE s.id = p_song_id;

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
