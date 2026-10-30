-- v6: 투표 익명/기명 모드
-- TRUE(default) = 익명. 다른 사용자에게 누가 어떻게 투표했는지 노출 X
-- FALSE = 기명. 다른 사용자에게 voter nickname 노출
-- 컬럼은 NOT NULL이므로 기존 행은 자동으로 TRUE 적용.

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS votes_anonymous BOOLEAN NOT NULL DEFAULT TRUE;
