-- v5: 5중 제약 필터를 위한 곡 메타 확장
-- key_root + key_mode (구조화된 키), difficulty (1-5), genre (제한된 목록)
-- 기존 key_memo 컬럼은 자유 메모로 유지

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS key_root TEXT
    CHECK (key_root IS NULL OR key_root IN
      ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B'));

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS key_mode TEXT
    CHECK (key_mode IS NULL OR key_mode IN ('major','minor'));

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS difficulty SMALLINT
    CHECK (difficulty IS NULL OR (difficulty BETWEEN 1 AND 5));

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS genre TEXT
    CHECK (genre IS NULL OR genre IN
      ('rock','pop','ballad','indie','punk','metal','jazz',
       'hiphop','rnb','electronic','kpop','other'));

-- 자주 필터링하는 컬럼 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_songs_tempo_bpm ON songs(tempo_bpm);
CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
