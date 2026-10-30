---
name: server-action
description: Plypick 의 Server Action(src/actions/*) 을 새로 만들거나 고칠 때 쓴다. 클라이언트 선택(공개 키 vs service_role), 로그인·권한·보관 합주방 검사 순서, 쓰기 뒤 행 수 확인, 반환 모양({ success, reason }), revalidatePath, 액션 테스트(fake-supabase) 를 다룬다. Supabase 에 쓰는 새 경로, 새 화면 동작에 붙는 액션, 권한 검사를 바꾸는 작업이면 먼저 읽는다.
---

# Server Action 만들기

`"use server"` 파일에서 export 한 async 함수는 **누구나 POST 로 부를 수 있는 공개 엔드포인트**다. 화면에서 숨겨도
마찬가지다. 그래서 모든 액션은 스스로 로그인·권한을 검사한다. 본보기는 `src/actions/team.ts` 다.

## 순서

1. **어디에 둘지 정한다.**
   - 화면(클라이언트 컴포넌트)이 부르는 쓰기·읽기 → `src/actions/<개념>.ts`
   - 서버 컴포넌트·다른 액션만 부르는 헬퍼(권한 검사·여러 단계 insert) → `src/lib/` 의 일반 모듈. `"use server"` 를
     붙이지 않는다(`src/lib/room-insert.ts` 머리 주석). 같은 파일 안에서만 쓰는 함수는 export 하지 않는다
   - 입력 검사·계산 같은 순수 규칙 → `src/domain/` 함수로 빼고 표 테스트를 붙인다. 액션은 그 함수를 부른다
2. **클라이언트를 고른다.**
   - `createServerSupabaseClient()` 는 publishable 키 + 사용자 세션이다. RLS 가 적용된다
   - `createAdminClient()` 는 secret 키(service_role)다. RLS 를 건너뛰므로 **권한 검사를 코드에서 반드시** 한다.
     `votes`·`teams`·`team_members`·`playlist_admin` 과 `songs` UPDATE 는 공개 키로 닿지 않는다(`docs/adr/0013`)
3. **검사를 이 순서로 한다.** 로그인(`getCurrentUser`) → 입력 검사(domain 함수) → 보관 합주방
   (`assertPlaylistWritable`·`assertPlaylistWritableBySong`, `docs/adr/0012`) → 역할(방장 `assertPlaylistAdmin`,
   셋리스트 편집 `assertSetlistEditor`, 밴드는 `team.ts` 의 `readMyRole`). 플레이리스트에 쓰는 새 경로는 보관 검사를
   빠뜨리지 않는다
4. **쓰고 나서 행 수를 확인한다.** 조건에 맞는 행이 없거나 RLS 가 막은 UPDATE·DELETE 는 **에러 없이 0행**이다.
   `.update(...).eq(...).select("id")` 로 받아 `data.length === 0` 을 실패로 처리한다. 이걸 빼서 키·BPM 저장이
   한동안 조용히 실패했다
5. **반환 모양.** 새 액션은 `ActionResult<T, Reason>`(`src/domain/types.ts`)을 돌려준다.
   예상된 실패(권한 없음·입력 오류·보관 합주방)는 `{ success: false, reason }` 이고, 화면 문구는 reason 맵에서 만든다
   (`src/lib/team-messages.ts`). **throw 는 예상 못 한 실패에만** 쓴다. 프로덕션 빌드는 throw 된 메시지를 가려서
   화면에 한국어 문구가 닿지 않는다. 기존 throw 액션(song·setlist·comment·playlist·member)은 아직 옛 모양이다.
   고칠 때 함께 옮긴다
6. **캐시를 갱신한다.** 바뀐 화면 경로를 `revalidatePath` 한다(`/playlist/${shareCode}`, `/band/${teamId}`).
   같은 방을 연 다른 화면은 broadcast 알림으로 다시 읽는다(`docs/adr/0010`). `postgres_changes` 구독은 lint 가 막는다
7. **로그.** `console.error` 에는 액션 이름과 id 만 남긴다. 닉네임·이메일은 남기지 않는다
8. **익명 모드.** 투표자를 내려보내는 응답은 `shouldExposeVoters` 를 거친다. 계정 식별자는 어느 모드에서도
   내려보내지 않는다(`docs/adr/0011`)

## 테스트

`src/actions/__tests__/<개념>.test.ts` 에 동작으로 쓴다. Supabase 는 `fake-supabase.ts` 로 바꾸고, 테스트는
"어떤 테이블에 어떤 조건으로 무엇을 썼는가(ops)"와 반환값을 본다.

- 권한 표의 각 줄마다 거절 케이스 하나: 비로그인, 남의 방, 보관 합주방
- 0행 UPDATE 를 실패로 돌려주는지
- 순수 규칙은 액션 테스트가 아니라 `src/domain/__tests__` 의 표 테스트로

## 끝내기 전에

- `npm run check` 통과
- 투표·투표권·투표 방식을 쓰는 경로를 바꿨다면 `verify-vote-quota` 스킬
- 새 공개 키 경로를 열었다면 `npm run audit:anon`
