#!/usr/bin/env node
// 다음 번호 마이그레이션 파일을 템플릿으로 만든다. 이미 있는 파일은 건드리지 않는다.
//
//   npm run db:new -- "밴드 공지 테이블"
//
// 규칙은 supabase/README.md "새 마이그레이션 쓰기".
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('사용법: npm run db:new -- "무엇을 하는 마이그레이션인지"');
  process.exit(1);
}

const last = Math.max(...readdirSync(dir).map((f) => Number(f.match(/^v(\d+)\.sql$/)?.[1] ?? 0)));
const next = last + 1;
const name = `v${String(next).padStart(2, "0")}.sql`;
const file = join(dir, name);
if (existsSync(file)) {
  console.error(`${name} 가 이미 있다.`);
  process.exit(1);
}

writeFileSync(
  file,
  `-- Plypick v${next}: ${title}
-- Run after supabase/migrations/v${String(last).padStart(2, "0")}.sql. 코드 배포 전/후/무관 중 하나와 이유를 적는다.
--
-- 하는 일
--   (무엇을 왜 바꾸는지)
--
-- 다시 실행해도 무해하다 (IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS).

BEGIN;

-- 새 테이블이면 권한을 기본값에 기대지 않는다 (supabase/README.md):
-- REVOKE ALL ON <table> FROM anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role;

COMMIT;

-- ============================================================
-- 적용 확인
-- ============================================================
-- 1) (적용 뒤 돌려 볼 SELECT 와 기대값)
`,
);
console.log(`${relative(root, file)} 를 만들었다. supabase/README.md 적용 순서 표에 한 줄 더한다.`);
