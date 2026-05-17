-- v9: 공연 포스터 URL
-- 셋리스트 배경에 블러 처리된 포스터 이미지를 표시하기 위한 URL 컬럼.
-- 실제 파일은 Supabase Storage 의 setlist-posters 버킷 (public read).

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS poster_url TEXT;
