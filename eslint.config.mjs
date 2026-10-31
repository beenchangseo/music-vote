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
              regex: "^(?!\\./|@/domain/)",
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
        // Color roles (AGENTS.md "디자인 시스템"). primary and danger are fills; as text on dark they
        // fall to about 3.1:1 and 3.7:1.
        ...["Literal[value=", "TemplateElement[value.raw="].flatMap((node) => [
          {
            selector: `${node}/(^|[\\s:])text-primary(?!-fg(?![\\w-]))/]`,
            message: "보라 글자·아이콘은 text-primary-fg, primary-tint 위 글자는 text-on-primary-tint 를 쓴다. text-primary 는 어두운 표면 위에서 4.5:1 이 안 나온다.",
          },
          {
            selector: `${node}/(^|[\\s:])text-danger(?!-fg(?![\\w-]))/]`,
            message: "빨강 글자는 text-danger-fg 를 쓴다. danger 는 채움 색이다.",
          },
          {
            selector: `${node}/primary-soft/]`,
            message: "primary-soft 는 지웠다. 선택·tonal 바탕은 primary-tint 를 쓴다.",
          },
        ]),
      ],
    },
  },
]);

export default eslintConfig;
