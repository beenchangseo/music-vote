# 공개 anon 키로는 쓰기 경로도 투표 조회 경로도 열어 두지 않는다

`NEXT_PUBLIC_SUPABASE_ANON_KEY`는 브라우저에 그대로 담겨 나간다. 이 키로 할 수 있는 일은 공개해도 되는 조회로 한정한다. 합주방의 모든 변경은 방장·등록자 검사를 마친 Server Action이 `service_role`로 수행하거나, 권한 검사를 내장한 `SECURITY DEFINER` 함수가 수행한다.

`votes` 테이블은 anon과 authenticated 모두 직접 읽지 못한다. 화면은 다음 두 뷰로만 투표를 읽는다.

- `song_vote_summary` — 곡별 점수와 표 수, 그리고 `auth.uid()`로 고른 내 표
- `song_voters` — `votes_anonymous = false`인 합주방의 투표자 닉네임과 방향

두 뷰는 `SECURITY DEFINER`라 `votes` 권한을 회수한 뒤에도 집계할 수 있고, 뷰가 담지 않는 정보는 어떤 클라이언트도 얻을 수 없다.

## Consequences

- 조회 전까지 남아 있던 구멍들이 닫힌다. `playlists`의 `UPDATE USING (true)`로 가능하던 합주방 탈취와 익명 해제, `songs`의 `UPDATE USING (true)`로 가능하던 곡 변조, `votes`·`comments`의 `user_id IS NULL` 예외로 가능하던 유령 표와 댓글이 모두 막힌다.
- 익명 보장이 화면과 페이로드를 넘어 데이터베이스까지 이어진다. [ADR 0011](./0011-anonymous-mode-hides-voters-in-payload.md)의 미완 항목이 여기서 닫힌다.
- 새 화면이 투표를 읽어야 하면 테이블이 아니라 뷰를 늘린다. 뷰에 열을 더할 때는 그 열이 익명 모드에서도 공개해도 되는지 먼저 판단한다.
- `scripts/audit-anon-access.mjs`가 이 계약을 확인한다. 마이그레이션 뒤 한 번 돌려 모두 통과하는지 본다.
- 통계 뷰 `playlist_stats`·`home_stats`도 `SECURITY DEFINER`여야 한다. `security_invoker = on`이면 `votes` 권한 회수와 함께 집계가 막힌다.
