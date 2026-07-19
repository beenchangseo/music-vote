-- Plypick v10: 투표권 할당, 셋리스트 편집, 다른 버전, 포스터/캘린더 정리
-- Run after supabase-migration-v9.sql.

-- ============================================================
-- 합주방 투표/셋리스트 설정
-- ============================================================
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS voting_mode TEXT NOT NULL DEFAULT 'free'
    CHECK (voting_mode IN ('free', 'allocated'));

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS default_vote_limit SMALLINT NOT NULL DEFAULT 3
    CHECK (default_vote_limit BETWEEN 1 AND 99);

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS setlist_edit_mode TEXT NOT NULL DEFAULT 'everyone'
    CHECK (setlist_edit_mode IN ('everyone', 'host_only'));

ALTER TABLE playlist_members
  ADD COLUMN IF NOT EXISTS vote_limit SMALLINT NOT NULL DEFAULT 3
    CHECK (vote_limit BETWEEN 0 AND 99);

-- ============================================================
-- 셋리스트 블록 확장
-- ============================================================
ALTER TABLE setlist_items
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 200);

ALTER TABLE setlist_items
  ADD COLUMN IF NOT EXISTS title_override TEXT
    CHECK (title_override IS NULL OR char_length(title_override) BETWEEN 1 AND 200);

ALTER TABLE setlist_items
  ADD COLUMN IF NOT EXISTS duration_override_seconds INT
    CHECK (duration_override_seconds IS NULL OR duration_override_seconds >= 0);

-- ============================================================
-- 후보곡의 다른 버전
-- ============================================================
CREATE TABLE IF NOT EXISTS song_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 100),
  added_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by_nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_song_versions_song
  ON song_versions(song_id, created_at);

ALTER TABLE song_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_versions_select" ON song_versions;
CREATE POLICY "song_versions_select" ON song_versions
  FOR SELECT USING (true);

-- 쓰기는 Server Action이 service role로 수행하고 그 전에 권한을 검사한다.
DROP POLICY IF EXISTS "song_versions_insert" ON song_versions;
DROP POLICY IF EXISTS "song_versions_update" ON song_versions;
DROP POLICY IF EXISTS "song_versions_delete" ON song_versions;

-- ============================================================
-- 셋리스트 RLS: 모두 편집 또는 방장
-- legacy 합주방은 everyone일 때 링크 방문자 편집을 유지한다.
-- 로그인 합주방의 everyone은 등록된 참여자만 편집한다.
-- ============================================================
DROP POLICY IF EXISTS "setlist_items_insert" ON setlist_items;
CREATE POLICY "setlist_items_insert" ON setlist_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM playlists p
      WHERE p.id = playlist_id
        AND (
          p.creator_user_id = auth.uid()
          OR (
            p.setlist_edit_mode = 'everyone'
            AND (
              p.creator_user_id IS NULL
              OR EXISTS (
                SELECT 1 FROM playlist_members pm
                WHERE pm.playlist_id = p.id AND pm.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "setlist_items_update" ON setlist_items;
CREATE POLICY "setlist_items_update" ON setlist_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM playlists p
      WHERE p.id = playlist_id
        AND (
          p.creator_user_id = auth.uid()
          OR (
            p.setlist_edit_mode = 'everyone'
            AND (
              p.creator_user_id IS NULL
              OR EXISTS (
                SELECT 1 FROM playlist_members pm
                WHERE pm.playlist_id = p.id AND pm.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "setlist_items_delete" ON setlist_items;
CREATE POLICY "setlist_items_delete" ON setlist_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM playlists p
      WHERE p.id = playlist_id
        AND (
          p.creator_user_id = auth.uid()
          OR (
            p.setlist_edit_mode = 'everyone'
            AND (
              p.creator_user_id IS NULL
              OR EXISTS (
                SELECT 1 FROM playlist_members pm
                WHERE pm.playlist_id = p.id AND pm.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

-- ============================================================
-- 첫 방문 참여자 등록
-- ============================================================
CREATE OR REPLACE FUNCTION register_playlist_member(p_playlist_id UUID)
RETURNS TABLE (vote_limit SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_name TEXT;
  v_default SMALLINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COALESCE(
      raw_user_meta_data->>'preferred_username',
      raw_user_meta_data->>'user_name',
      raw_user_meta_data->>'nickname',
      raw_user_meta_data->>'name',
      raw_user_meta_data->>'full_name',
      split_part(email, '@', 1),
      '사용자'
    )
    INTO v_name
  FROM auth.users
  WHERE id = v_user_id;

  SELECT default_vote_limit
    INTO v_default
  FROM playlists
  WHERE id = p_playlist_id;

  IF v_default IS NULL THEN
    RAISE EXCEPTION '합주방을 찾을 수 없습니다.';
  END IF;

  INSERT INTO playlist_members (playlist_id, user_id, display_name, vote_limit)
  VALUES (p_playlist_id, v_user_id, v_name, v_default)
  ON CONFLICT (playlist_id, user_id)
  DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN QUERY
  SELECT pm.vote_limit
  FROM playlist_members pm
  WHERE pm.playlist_id = p_playlist_id AND pm.user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION register_playlist_member(UUID) TO authenticated;

-- ============================================================
-- 로그인 합주방 투표: 투표권 검사와 변경을 한 트랜잭션에서 처리
-- ============================================================
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

  SELECT pm.vote_limit
    INTO v_limit
  FROM playlist_members pm
  WHERE pm.playlist_id = v_playlist_id AND pm.user_id = v_user_id
  FOR UPDATE;

  SELECT v.id, v.vote_type
    INTO v_existing_id, v_existing_type
  FROM votes v
  WHERE v.song_id = p_song_id AND v.user_id = v_user_id;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_type = p_vote_type THEN
      DELETE FROM votes WHERE id = v_existing_id;
      result := 'removed';
    ELSE
      UPDATE votes SET vote_type = p_vote_type WHERE id = v_existing_id;
      result := 'changed';
    END IF;
  ELSE
    IF v_mode = 'allocated' THEN
      SELECT count(*)::INT
        INTO v_used
      FROM votes v
      JOIN songs s ON s.id = v.song_id
      WHERE s.playlist_id = v_playlist_id AND v.user_id = v_user_id;

      IF v_used >= v_limit THEN
        RAISE EXCEPTION '투표권을 모두 사용했습니다.';
      END IF;
    END IF;

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

-- ============================================================
-- 방장 투표 설정: 투표가 없을 때만 모드 전환
-- ============================================================
CREATE OR REPLACE FUNCTION configure_playlist_voting(
  p_playlist_id UUID,
  p_mode TEXT,
  p_default_limit SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_current_mode TEXT;
  v_vote_count INT;
BEGIN
  IF p_mode NOT IN ('free', 'allocated') THEN
    RAISE EXCEPTION '잘못된 투표 모드입니다.';
  END IF;
  IF p_default_limit < 1 OR p_default_limit > 99 THEN
    RAISE EXCEPTION '기본 투표권은 1~99개여야 합니다.';
  END IF;

  SELECT creator_user_id, voting_mode
    INTO v_creator, v_current_mode
  FROM playlists
  WHERE id = p_playlist_id
  FOR UPDATE;

  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF v_current_mode IS DISTINCT FROM p_mode THEN
    SELECT count(*)::INT
      INTO v_vote_count
    FROM votes v
    JOIN songs s ON s.id = v.song_id
    WHERE s.playlist_id = p_playlist_id;

    IF v_vote_count > 0 THEN
      RAISE EXCEPTION '투표가 시작된 뒤에는 모드를 바꿀 수 없습니다.';
    END IF;
  END IF;

  UPDATE playlists
  SET voting_mode = p_mode,
      default_vote_limit = p_default_limit
  WHERE id = p_playlist_id;

  IF v_current_mode IS DISTINCT FROM p_mode AND p_mode = 'allocated' THEN
    UPDATE playlist_members
    SET vote_limit = p_default_limit
    WHERE playlist_id = p_playlist_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION configure_playlist_voting(UUID, TEXT, SMALLINT) TO authenticated;

CREATE OR REPLACE FUNCTION set_member_vote_limit(
  p_playlist_id UUID,
  p_user_id UUID,
  p_vote_limit SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_used INT;
BEGIN
  IF p_vote_limit < 0 OR p_vote_limit > 99 THEN
    RAISE EXCEPTION '투표권은 0~99개여야 합니다.';
  END IF;

  SELECT creator_user_id INTO v_creator
  FROM playlists WHERE id = p_playlist_id;
  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  SELECT count(*)::INT INTO v_used
  FROM votes v
  JOIN songs s ON s.id = v.song_id
  WHERE s.playlist_id = p_playlist_id AND v.user_id = p_user_id;

  IF v_used > p_vote_limit THEN
    RAISE EXCEPTION '이미 %표를 사용 중이라 %표로 줄일 수 없습니다.', v_used, p_vote_limit;
  END IF;

  UPDATE playlist_members
  SET vote_limit = p_vote_limit
  WHERE playlist_id = p_playlist_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '참여자를 찾을 수 없습니다.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_member_vote_limit(UUID, UUID, SMALLINT) TO authenticated;

CREATE OR REPLACE FUNCTION apply_vote_limit_to_all(
  p_playlist_id UUID,
  p_vote_limit SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_blocked_name TEXT;
  v_blocked_used INT;
BEGIN
  IF p_vote_limit < 0 OR p_vote_limit > 99 THEN
    RAISE EXCEPTION '투표권은 0~99개여야 합니다.';
  END IF;

  SELECT creator_user_id INTO v_creator
  FROM playlists WHERE id = p_playlist_id;
  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  SELECT pm.display_name, count(v.id)::INT
    INTO v_blocked_name, v_blocked_used
  FROM playlist_members pm
  LEFT JOIN songs s ON s.playlist_id = pm.playlist_id
  LEFT JOIN votes v ON v.song_id = s.id AND v.user_id = pm.user_id
  WHERE pm.playlist_id = p_playlist_id
  GROUP BY pm.user_id, pm.display_name
  HAVING count(v.id) > p_vote_limit
  ORDER BY count(v.id) DESC
  LIMIT 1;

  IF v_blocked_name IS NOT NULL THEN
    RAISE EXCEPTION '%님이 이미 %표를 사용 중이라 일괄 변경할 수 없습니다.', v_blocked_name, v_blocked_used;
  END IF;

  UPDATE playlist_members
  SET vote_limit = p_vote_limit
  WHERE playlist_id = p_playlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_vote_limit_to_all(UUID, SMALLINT) TO authenticated;

-- ============================================================
-- 포스터 완전 제거
-- 먼저 `node scripts/remove-setlist-posters.mjs --apply`로 Storage API를 통해
-- 실제 파일과 버킷을 삭제한다. storage.objects 직접 DELETE는 실제 파일을
-- 고아 객체로 남길 수 있으므로 사용하지 않는다. 그 다음 이 컬럼을 제거한다.
-- ============================================================
ALTER TABLE playlists DROP COLUMN IF EXISTS poster_url;
