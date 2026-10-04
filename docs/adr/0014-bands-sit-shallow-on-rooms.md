# 밴드(팀)는 합주방 위에 얕게 얹는다

밴드는 합주방들을 묶는 이름표다. 합주방의 권한과 투표 규칙은 그대로 방 단위에 두고, `playlists`에 nullable `team_id` 하나만 더한다(`supabase-migration-v19.sql`). 방장 권한·투표권·셋리스트 편집 권한은 지금처럼 그 방의 `creator_user_id`·`playlist_members`가 정하고, 밴드 멤버라고 남의 방에서 더 할 수 있는 일은 없다. v10의 RLS와 `cast_playlist_vote` 같은 함수는 밴드를 모른다.

코드와 DB에서는 `team`, 화면에서는 "밴드"라고 부른다.

밴드에는 주소가 두 개 있다. 멤버가 돌아오는 밴드 홈은 `/band/{teamId}`이고, 단톡방에 뿌리는 초대 링크는 `/join/{inviteCode}`다. 초대 링크를 새로 만들면 옛 `/join/{옛 코드}`와 이미 돈 카톡 카드만 죽고, 멤버의 북마크와 홈 "내 밴드"·방의 밴드 경로 줄·`/new?band=`가 쓰는 `teamId` 주소는 그대로다. 그래서 링크 교체가 멤버의 길을 끊지 않는다. 비멤버가 `/band/{teamId}`를 열면 밴드 이름과 "밴드 멤버만 볼 수 있어요"만 보이고, 방 목록·멤버·공연 날짜·초대 코드는 내려가지 않는다. 초대 화면은 이름·멤버 수·앞 3명 이름·공연 날짜만 보여준다.

`teams`·`team_members`는 닫힌 채로 태어난다. RLS를 켜고 정책을 두지 않으며 anon·authenticated의 권한을 모두 회수한다. 읽기와 쓰기는 모두 `src/actions/team.ts`의 Server Action이 `service_role`로 하고, 누가 owner·member·방장인지는 그 코드가 검사한다. 예상된 실패는 throw 하지 않고 `{ success: false, reason }`으로 돌려주며, 화면은 `src/lib/team-messages.ts`로 문구를 만든다.

## Consequences

- 방이 밴드에 들어오는 길은 셋이다. 방에서 "이 멤버로 밴드 만들기"(`promote`), 밴드 홈의 "새 합주방"(`band`), 이미 있던 방을 넣기(`attach`). `playlists.team_linked_via`가 이 경로를 남기고, 성공 지표 "밴드에서 만든 새 방"은 `band`만 센다.
- 밴드로 올릴 때 그 방의 `playlist_members` 전원이 멤버가 된다. 방을 한 번 연 로그인 사용자도 포함되므로, owner가 아닌 멤버는 스스로 "밴드 나가기"를 할 수 있다. owner는 한 명이고 이전 경로가 없다.
- 내보내기와 나가기는 밴드에서만 뺀다. 그 사람이 이미 들어간 방의 참여자 자격과 방 링크는 그대로다. 홈 "내 합주방"에서 밴드 방 집합으로만 보이던 방이 빠진다.
- 한 방은 한 밴드에만 들어간다. 묶을 때는 `.is("team_id", null)` 조건부 UPDATE로 하고, 밴드에서 방을 빼는 기능은 없다. 밴드를 지우면 방은 팀 없는 방으로 돌아간다(`ON DELETE SET NULL`).
- 권한 검사가 코드에만 있다. `service_role` 경로에서 검사 하나가 빠지면 막을 장치가 없으므로, 액션마다 권한 표(계획 문서)와 액션 테스트(`src/actions/__tests__/team.test.ts`)가 방어선이다. `npm run audit:anon`이 두 테이블이 공개 키로 닫혀 있는지 확인한다.
- 나중에 "밴드 멤버면 밴드 방의 관리자" 같은 밴드 단위 권한이 필요해지면 방의 RLS와 v10 함수를 다시 봐야 한다. 그때가 얕은 결합을 깊은 결합으로 바꾸는 결정이다.
