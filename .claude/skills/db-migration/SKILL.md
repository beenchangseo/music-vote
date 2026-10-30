---
name: db-migration
description: Supabase 스키마·RLS·권한·SQL 함수를 바꿀 때 쓴다. 새 테이블·컬럼·인덱스·뷰·정책·GRANT/REVOKE·SECURITY DEFINER 함수를 추가하거나, 기존 SQL 함수를 다시 정의하거나, 코드 배포와 마이그레이션 적용 순서를 정해야 할 때. 마이그레이션 파일 번호 매기기, 다시 실행해도 안전하게 쓰기, 운영 적용 절차를 다룬다.
---

# DB 마이그레이션

규칙의 원본은 `supabase/README.md` 다. 이 스킬은 순서만 짚는다.

## 순서

1. **새 파일을 만든다.** `npm run db:new -- "무엇을 하는지"` 가 `supabase/migrations/vNN.sql` 을 템플릿으로 만든다.
   적용된 파일(main 에 있는 vNN)은 고치지 않는다. hook 이 편집을 막는다
2. **머리 주석을 채운다.** 무엇을 왜 바꾸는지, 코드 배포 **전/후/무관** 중 무엇이고 그 이유. 순서를 어기면 무엇이
   깨지는지 한 줄
3. **본문을 쓴다.**
   - 다시 실행해도 같은 결과: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`
   - 새 테이블: `REVOKE ALL … FROM anon, authenticated;` + `GRANT SELECT, INSERT, UPDATE, DELETE … TO service_role;`.
     시퀀스는 `GRANT USAGE, SELECT ON SEQUENCE …`. RLS 를 켠다
   - service_role 전용 함수: `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;` 뒤
     `GRANT EXECUTE … TO service_role;` (v11 이 본보기)
   - 공개 키 경로가 정말 필요하면 필요한 권한만 주고 이유를 주석과 `docs/adr/` 에 남긴다(`docs/adr/0013`)
   - 끝에 "적용 확인" SELECT 와 기대값을 적는다
4. **코드와 타입을 맞춘다.** 행 모양이 바뀌면 `src/domain/types.ts`. 새 테이블을 읽고 쓰는 액션은 `server-action` 스킬
5. **표에 한 줄 더한다.** `supabase/README.md` "적용 순서" 표
6. **로컬 검사.** `npm run check`. 투표·투표권·투표 방식을 쓰는 SQL 함수를 바꿨다면 `verify-vote-quota` 스킬
   (`node verification/vote-quota/drift.mjs` 가 drift 를 알린다)

## 운영 적용

운영 DB 에 SQL 을 실행하는 것은 되돌리기 어렵다. **운영자의 명시적인 승인을 받고** 진행한다.

- 경로: DataGrip `postgres@plypick`(서울) 연결, 또는 Supabase SQL Editor
- 배포 **전** 마이그레이션이면 적용 → 머지·push. 배포 **후** 면 머지·push → 배포 확인 → 적용
- 적용 뒤 파일 끝의 "적용 확인" SELECT 를 돌리고, `npm run audit:anon` 으로 공개 키 경로를 확인한다
- 결과(적용 시각, 확인 결과)를 PR 이나 커밋 메시지에 남긴다
