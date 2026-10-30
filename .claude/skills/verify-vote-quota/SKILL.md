---
name: verify-vote-quota
description: 투표권(할당 투표 한도)·투표 방식·투표 쓰기의 동시성 약속을 TLA+ 모델로 검사한다. cast_playlist_vote, register_playlist_member, save_playlist_voting_settings, configure_playlist_voting, set_member_vote_limit, apply_vote_limit_to_all 을 바꾸거나, votes 행·playlist_members.vote_limit·playlists.voting_mode 를 쓰는 SQL·서버 코드를 새로 만들거나 고칠 때, 또는 투표 설정 저장 흐름(saveVotingSettings)을 바꿀 때 쓴다.
---

# 투표권 동시성 검사 (verify-vote-quota)

`verification/vote-quota/VoteQuota.tla` 는 투표와 방장 설정 함수가 **동시에** 돌 때 생길 수 있는 모든 실행 순서를
TLC 로 끝까지 훑는다. 단위 테스트(`src/actions/__tests__/vote.test.ts`)는 RPC 를 목으로 바꾸므로 이 순서에 닿지 않는다.

## 지키는 약속

| 성질 | 한 문장 | 깨지면 |
|---|---|---|
| `QuotaHolds` | 할당 모드에서 멤버가 가진 표 수는 그 멤버의 투표권(`vote_limit`)을 넘지 않는다 | 방장이 정한 것보다 표를 많이 가진 멤버가 생겨 투표 결과가 불공정해진다 |
| `FreeOneVotePerSong` | 자유 모드에서 멤버는 곡마다 표를 하나만 가진다 | 한 사람이 한 곡에 두 표를 넣어 순위가 부풀려진다 |
| `VotesMatchMode` | 투표가 시작되면 방식이 바뀌지 않으므로, 모든 표는 지금 방식의 규칙으로 들어갔다 | 다른 방식의 규칙(예: 한도 검사 없음)으로 들어간 표가 남는다 |

## 검사 범위 (coverage)

모델의 action 하나 = SQL 문 하나. 각 action 위 주석이 해당 줄을 가리킨다.

| 함수 | 파일 | 누가 부르나 |
|---|---|---|
| `cast_playlist_vote` | `supabase/migrations/v12.sql` | `src/actions/vote.ts` `castVote` |
| `register_playlist_member` | `supabase/migrations/v10.sql` | `cast_playlist_vote` 안 (`src/actions/member.ts` 에서도) |
| `save_playlist_voting_settings` | `supabase/migrations/v11.sql` | 설정 시트 → `src/actions/member.ts` `saveVotingSettings` (service_role) |
| `configure_playlist_voting` | `supabase/migrations/v10.sql` | 앱 코드는 부르지 않는다(member.ts 의 래퍼는 2026-10-31 삭제). `authenticated` 실행 권한은 열려 있어 RPC 로 직접 부를 수 있다 |
| `set_member_vote_limit` | `supabase/migrations/v10.sql` | 같음 |
| `apply_vote_limit_to_all` | `supabase/migrations/v10.sql` | 같음 |

**마지막 동기화 커밋: `c8bc72f`** — 이 커밋의 코드가 모델과 같다고 확인했다. 위 함수들의 정의 해시는
`verification/vote-quota/covered.json` 에 있다.

## 언제 쓰나

변경이 다음 중 하나에 닿으면 이 검사를 돌린다.

- 위 표의 함수를 새 마이그레이션에서 다시 정의한다 (`CREATE OR REPLACE FUNCTION`)
- `votes` 에 INSERT/UPDATE/DELETE, `playlist_members.vote_limit` UPDATE, `playlists.voting_mode` UPDATE 를 하는 SQL 함수나 서버 코드를 새로 만든다
- `castVote`·`saveVotingSettings` 가 RPC 를 부르는 방식을 바꾼다 (예: RPC 앞에 별도 조회·쓰기를 추가)

닿는지 모르겠으면 그냥 돌린다. 30초쯤 걸린다.

## 돌리기

```sh
verification/vote-quota/check.sh          # 시나리오 5개 × 성질 3개, 약 30초
verification/vote-quota/check.sh save     # 시나리오 하나만
```

- Java 11+ 가 필요하다. 없으면 `brew install openjdk` (macOS). `/usr/bin/java` 스텁은 JDK 가 아니다. 다른 위치면 `JAVA=/path/to/java`
- 첫 실행은 tla2tools 1.7.4 를 `.tools/tla/` 로 받고 sha256 을 확인한다 (git 에 안 들어감)
- 결과·로그·실행에 쓴 cfg 는 `verification/vote-quota/out/` 에 남는다 (git 에 안 들어감)

시나리오: `voters`(같은 멤버의 동시 투표 2개만), `save`·`configure`·`setLimit`·`applyAll`(동시 투표 2개 + 그 방장 함수 1개).

### 결과 읽기

- 표의 각 줄은 `시나리오 성질 결과 상태수`. 결과는 `pass`·`fail`·`deadlock`·`error`
- `expected.txt` 와 다르면 `MISMATCH` 줄이 나오고 exit 1. **`fail` 이 기대값인 줄은 아래 "알려진 결함"** 이다
- `DRIFT` 는 `drift.mjs` 가 찾은 것: 검사 범위의 SQL 이 동기화 이후 바뀌었거나, 모델 밖의 함수·서버 코드가 같은 행을 쓴다. 모델이 지금 코드를 설명하는지 다시 봐야 한다는 뜻이고, 통과 결과도 믿으면 안 된다
- `error` 는 모델이나 cfg 문제다. `out/<시나리오>-<성질>.out` 을 읽는다
- **모든 결과(실패든 통과든)는 pstack 의 `/statechart` 스킬로 읽는다.** 스펙은 `verification/vote-quota/VoteQuota.tla`, 설정은 그 실행의 `out/<시나리오>-<성질>.cfg`. 실패면 가장 짧은 위반 경로를 단계별 문장으로, 통과면 상태 전이 차트를 준다

### 진짜 버그인가, 모델 오류인가

실패 경로를 실제 코드에 한 단계씩 대 본다. 각 action 주석의 SQL 줄로 가서 그 문장이 그 순서로 실행될 수 있는지 본다.

- 한 단계라도 코드에서 일어날 수 없으면 모델이 틀렸다. 모델을 코드에 맞게 고친다
- 모든 단계가 가능하면 버그다. `verification/vote-quota/replay.sh`(Docker 필요)는 마이그레이션의 함수 정의를 그대로 올린 임시 Postgres 17 에서 경로를 재현한다. 새 경로도 같은 방식(한 세션의 트랜잭션을 `pg_sleep` 으로 열어 두기)으로 추가할 수 있다

판단에 쓰는 모델 규칙 (READ COMMITTED, Supabase 기본값):
- 한 문장은 커밋된 행 + 자기 트랜잭션의 쓰기를 본다
- `UPDATE`, `SELECT … FOR UPDATE`, `INSERT … ON CONFLICT DO UPDATE` 는 행 락을 잡고, 다른 트랜잭션이 잡고 있으면 기다린 뒤 최신 커밋 행에 작용한다
- 락은 커밋이나 `RAISE` 롤백 때 풀린다
- 기다리는 트랜잭션들 중 누가 먼저 락을 얻을지는 정하지 않는다

## 알려진 결함 (expected.txt 의 `fail`)

2026-10-31 확인, 코드는 고치지 않았다. 재현: `verification/vote-quota/replay.sh` 가 F1·F2 를 실제 SQL 로 재현한다(`REPRODUCED` 세 줄).

**F1. 한도를 줄이는 사이에 들어온 표를 세지 못한다** (#15) — `save`·`setLimit`·`applyAll` / `QuotaHolds`
1. 할당 모드, 멤버 한도 1, 표 0. 멤버가 투표: `cast_playlist_vote` 가 멤버 행 락을 잡고 사용 0 < 1 을 확인한다
2. 방장이 한도를 0 으로 저장: `save_playlist_voting_settings` 가 멤버의 표를 **락 없이** 센다(v11 l.85-94) → 0, 통과
3. 멤버의 표가 들어가고 커밋된다 (1표)
4. 방장의 `UPDATE playlist_members SET vote_limit = 0`(v11 l.109-115)이 락을 얻고 커밋된다 → **1표 > 한도 0**

`set_member_vote_limit`(v10 l.378-389), `apply_vote_limit_to_all`(v10 l.423-440)도 같은 "락 없이 세고 나중에 UPDATE" 순서다.

**F2. 투표가 예전 방식을 읽고 그 규칙으로 들어간다** (#16) — `save`·`configure` / 세 성질 모두
1. 자유 모드. 멤버의 투표가 `voting_mode` 를 **락 없이** 읽는다(v12 l.41) → `free`
2. 방장이 할당 모드(기본 한도 1)로 저장: 표가 0개라 방식 변경이 허용되고 커밋된다
3. 멤버의 투표가 이어서 1에서 읽은 `free` 분기(v12 l.88-100)로 가서 **한도 검사 없이** 표를 넣는다. 두 번 누르면 할당 모드에 2표 > 한도 1

반대 방향(할당 → 자유)도 같다. `configure` 시나리오에서 TLC 가 찾은 경로는 이렇다.
1. 투표 하나가 `allocated` 를 읽는다
2. 방식이 `free` 로 바뀐다
3. 다른 투표가 `free` 로 같은 곡에 표를 넣는다
4. 1의 투표가 할당 분기로 같은 곡에 표를 하나 더 넣는다

이 순서는 함수 안의 두 문장 사이가 늦어져야 생겨서 락으로 강제할 수 없어 replay 에는 없다. 원인은 F2 와 같다.

고치면 해당 줄이 `pass` 로 바뀐다. 고치는 변경에서 모델의 그 action 을 새 SQL 에 맞게 고치고, `expected.txt` 를 같은 변경에서 바꾼다.

## 변경이 의도된 것일 때 (모델 갱신)

1. 바뀐 SQL 문을 모델의 action 과 하나씩 맞춘다. 한 문장 = 한 action, 주석의 파일·줄을 새 위치로 고친다. 새 문장·분기·락은 새 action 이나 조건으로 넣는다
2. **결과를 보고 모델을 고치지 않는다.** 코드를 보고 먼저 고친 뒤 돌린다. 성질을 약하게 만들어 통과시키지 않는다. 약속 자체가 바뀐 경우(근거: 커밋 메시지·ADR·테스트)에만 성질을 바꾸고 그 근거를 적는다
3. `check.sh` 를 돌린다. 통과했으면, 그 변경이 지키는 부분을 모델에서 잠깐 망가뜨려(검사 하나 빼기, 순서 바꾸기) 실패하는지 본 뒤 되돌린다
4. 결과가 바뀐 줄은 `expected.txt` 를 고친다
5. `node verification/vote-quota/drift.mjs --write` 로 `covered.json` 을 갱신한다. 새 함수를 모델에 넣었으면 `drift.mjs` 의 `COVERED` 와 위 "검사 범위" 표에도 넣는다
6. 모델이 그 커밋의 코드를 설명한다고 확인한 뒤에만 위의 **마지막 동기화 커밋**을 그 커밋으로 옮긴다
7. 제품 코드 수정과 검사 갱신은 같은 PR 이어도 되지만, 이 스킬이 시키지 않은 제품 코드는 고치지 않는다

여러 커밋에 걸쳐 검사 없이 바뀐 것을 한꺼번에 맞출 때는 pstack 의 `maintain-formal-verification-skill` 을 쓴다.

## 범위와 가정

- 경계:
  - 같은 멤버의 동시 투표 2개 + 방장 함수 1개
  - 곡 2개, 한도 {0, 1, 2}, 기본 한도 {1, 2}
  - 시작할 때 멤버 표 0~1개
  - 이 경계 안의 모든 실행 순서를 본다
- 방장 함수끼리 동시에 도는 경우는 보지 않는다 (시나리오마다 하나)
- 멤버 행은 이미 있다. 투표는 한 멤버 것만 센다. `configure`·`save` 의 "전체 표 수" 검사도 그 멤버 표로만 센다
- 생략한 문장(행에 영향 없음): 방장 권한 확인, `cast` 가 끝에 돌려주는 사용 수, `display_name` 조회, 입력값 검증
- "가장 최근 표"(`ORDER BY created_at DESC, id DESC`)는 삽입 순서로 둔다. 같은 곡의 어느 행이 최신이든 표 수는 같다

## 검사하지 않는 것

- 새 멤버 등록 경쟁: `src/lib/room-insert.ts`(방장), `src/lib/setlist-permissions.ts`(셋리 편집자)의 `playlist_members` insert
- `resetPlaylistVotes`(`src/actions/playlist.ts`): 표를 지우기만 해서 세 성질을 깰 수 없다
- 곡·방 삭제, 여러 멤버, 익명 모드 응답(`docs/adr/0011`), RLS·실행 권한(누가 부를 수 있나), PostgREST 재시도

## 파일

`verification/vote-quota/` — `VoteQuota.tla`(모델), `check.sh`(실행), `expected.txt`(기대 결과), `drift.mjs`·`covered.json`(코드 변경 감지), `replay.sh`(실제 SQL 재현)
