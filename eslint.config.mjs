import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full repo copies; lint the real tree only.
    ".claude/worktrees/**",
  ]),
  {
    // The dependency rule of the layout (AGENTS.md "구조"): domain knows nothing outside itself,
    // so it stays testable without Next, Supabase or a browser.
    files: ["src/domain/**/*.ts"],
    ignores: ["src/domain/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\.{1,2}/|@/domain/)",
              message: "src/domain 은 순수 규칙만 둔다. 프레임워크·DB·네트워크가 필요하면 호출부(actions·lib)에서 값을 넘겨받는다.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "fetch", "window", "document", "localStorage", "sessionStorage", "navigator"],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value='postgres_changes']",
          message: "실시간은 내용 없는 broadcast 알림 + 재조회로 한다(docs/adr/0010). postgres_changes 로 votes 를 구독하면 익명 모드가 뚫린다.",
        },
      ],
    },
  },
]);

export default eslintConfig;
