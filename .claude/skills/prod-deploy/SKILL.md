---
name: prod-deploy
description: Plypick 을 프로덕션에 내보낼 때 쓴다. main 에 머지·push 하기 전(main push 가 곧 프로덕션 배포다), 마이그레이션이 있는 변경을 배포할 때, 배포 뒤 운영 화면·크론·OG 를 확인할 때. 로컬 게이트(npm run check, e2e), 마이그레이션 적용 순서, 배포 확인 목록을 다룬다.
---

# 배포

`main` push 는 Vercel 이 곧바로 프로덕션(`plypick.kr`)으로 배포한다. Preview 배포·스테이징 DB·CI 는 없다.
그래서 게이트는 모두 로컬에서 돈다. push 와 `vercel --prod` 는 hook 이 한 번 더 묻는다.

배포는 되돌리기 어려운 외부 동작이다. **운영자의 명시적인 승인 없이 main 에 push 하지 않는다.** 방장은 플레이리스트를 만든 사람이라는 제품 역할 이름이다.

## 순서

1. **브랜치에서 게이트를 통과한다.**
   - `npm run check` (typecheck · lint · test)
   - 화면·액션을 바꿨다면 e2e 게이트: `npm run test:e2e` (운영 DB 에 붙는다. 설정은 `e2e/README.md`)
   - 투표 경로를 바꿨다면 `verify-vote-quota` 스킬
   - `NODE_ENV=production npx next build` 가 끝까지 통과해야 한다. `NODE_ENV` 를 빼면 셸의 development 값 때문에
     `/_global-error` prerender 에서 실패한다(AGENTS.md "주의 사항")
2. **마이그레이션 순서를 지킨다** (`db-migration` 스킬). 배포 전 마이그레이션은 머지 전에 운영에 적용한다
3. **머지하고 push 한다.** `git switch main && git merge --no-ff <branch> && git push origin main`
4. **배포를 확인한다.**
   - Vercel 배포가 Ready 인지 (`vercel ls` 또는 대시보드)
   - 바꾼 화면을 운영에서 한 번 열어 본다. 휴대폰 크기로
   - 공유 카드를 바꿨다면 `/api/og?variant=…`, `/api/setlist-image/{shareCode}`, `/api/setlist-pdf/{shareCode}`
   - 새 마이그레이션이 배포 후 순서라면 지금 적용한다

## 환경변수

Vercel 환경변수는 Production 스코프에만 있다. 넣을 때는 줄바꿈이 붙지 않게
`printf '%s' "$VAL" | vercel env add NAME production --force --yes` 로 넣는다(`echo` 는 hook 이 막는다).
목록과 뜻은 `.env.example` 에 있다.
