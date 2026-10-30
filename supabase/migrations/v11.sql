-- Plypick v11: 투표 설정을 한 번에 저장
-- Run after supabase-migration-v10.sql.

CREATE OR REPLACE FUNCTION save_playlist_voting_settings(
  p_playlist_id UUID,
  p_votes_anonymous BOOLEAN,
  p_mode TEXT,
  p_default_limit SMALLINT,
  p_member_limits JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_mode TEXT;
  v_vote_count INT;
  v_limit JSONB;
  v_user_id UUID;
  v_vote_limit INT;
  v_used INT;
  v_display_name TEXT;
BEGIN
  IF p_votes_anonymous IS NULL THEN
    RAISE EXCEPTION '투표 공개 범위가 올바르지 않습니다.';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('free', 'allocated') THEN
    RAISE EXCEPTION '잘못된 투표 방식입니다.';
  END IF;
  IF p_default_limit IS NULL OR p_default_limit < 1 OR p_default_limit > 99 THEN
    RAISE EXCEPTION '기본 투표권은 1~99개여야 합니다.';
  END IF;
  IF p_member_limits IS NULL OR jsonb_typeof(p_member_limits) <> 'array' THEN
    RAISE EXCEPTION '참여자별 투표권 형식이 올바르지 않습니다.';
  END IF;

  SELECT voting_mode
    INTO v_current_mode
  FROM playlists
  WHERE id = p_playlist_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '합주방을 찾을 수 없습니다.';
  END IF;

  IF v_current_mode IS DISTINCT FROM p_mode THEN
    SELECT count(*)::INT
      INTO v_vote_count
    FROM votes v
    JOIN songs s ON s.id = v.song_id
    WHERE s.playlist_id = p_playlist_id;

    IF v_vote_count > 0 THEN
      RAISE EXCEPTION '투표가 시작된 뒤에는 방식을 바꿀 수 없습니다.';
    END IF;
  END IF;

  FOR v_limit IN SELECT value FROM jsonb_array_elements(p_member_limits)
  LOOP
    IF jsonb_typeof(v_limit) <> 'object'
      OR COALESCE(v_limit->>'user_id', '') = ''
      OR COALESCE(v_limit->>'vote_limit', '') !~ '^[0-9]+$'
    THEN
      RAISE EXCEPTION '참여자별 투표권 형식이 올바르지 않습니다.';
    END IF;

    v_user_id := (v_limit->>'user_id')::UUID;
    v_vote_limit := (v_limit->>'vote_limit')::INT;

    IF v_vote_limit < 0 OR v_vote_limit > 99 THEN
      RAISE EXCEPTION '참여자별 투표권은 0~99개여야 합니다.';
    END IF;

    SELECT display_name
      INTO v_display_name
    FROM playlist_members
    WHERE playlist_id = p_playlist_id AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION '참여자를 찾을 수 없습니다.';
    END IF;

    SELECT count(*)::INT
      INTO v_used
    FROM votes v
    JOIN songs s ON s.id = v.song_id
    WHERE s.playlist_id = p_playlist_id AND v.user_id = v_user_id;

    IF v_used > v_vote_limit THEN
      RAISE EXCEPTION '%님이 이미 %표를 사용 중이라 %표로 줄일 수 없습니다.',
        v_display_name, v_used, v_vote_limit;
    END IF;
  END LOOP;

  UPDATE playlists
  SET votes_anonymous = p_votes_anonymous,
      voting_mode = p_mode,
      default_vote_limit = p_default_limit
  WHERE id = p_playlist_id;

  IF v_current_mode IS DISTINCT FROM p_mode AND p_mode = 'allocated' THEN
    UPDATE playlist_members
    SET vote_limit = p_default_limit
    WHERE playlist_id = p_playlist_id;
  END IF;

  FOR v_limit IN SELECT value FROM jsonb_array_elements(p_member_limits)
  LOOP
    UPDATE playlist_members
    SET vote_limit = (v_limit->>'vote_limit')::INT
    WHERE playlist_id = p_playlist_id
      AND user_id = (v_limit->>'user_id')::UUID;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION save_playlist_voting_settings(UUID, BOOLEAN, TEXT, SMALLINT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_playlist_voting_settings(UUID, BOOLEAN, TEXT, SMALLINT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION save_playlist_voting_settings(UUID, BOOLEAN, TEXT, SMALLINT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION save_playlist_voting_settings(UUID, BOOLEAN, TEXT, SMALLINT, JSONB) TO service_role;
