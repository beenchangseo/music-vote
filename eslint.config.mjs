import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import ds from "./scripts/eslint-plugin-ds.mjs";

// Height, width, padding, radius and font-size utilities, after any variant prefix (`max-sm:px-0`) or `!`.
// The setlist toolbar shipped 44·36·44px buttons side by side because each call site resized its own.
const CONTROL_SIZE_UTILITY =
  "/(^|[\\s:])!?((min-|max-)?[hw]-|size-|p[xytrblse]?-|rounded(?![a-z])|text-(xs|sm|base|lg|[2-9]?xl|caption|body|display|h[1-6])(?![\\w-]))/";

const ROUND_SKIN_UTILITY = "/(^|[\\s:])!?(bg-|text-|font-|border|shadow|ring-|opacity-|scale-|-m[trblxyse]?-|[\\w-]*\\[)/";
const GLYPH_PLACEMENT_UTILITY =
  "/(^|[\\s:])!?((min-|max-)?[hw]-|size-|-?m[trblxyse]?-|p[xytrblse]?-|scale-|translate-|absolute|relative|[\\w-]*\\[)/";

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
    // Local agent scratch (gitignored): measurement scripts there are CommonJS and not part of the app.
    ".omc/**",
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
    // Registered for all of src so scripts/ds-inventory.mjs can turn on its inventory-only rules, ui included.
    plugins: { ds },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXElement[openingElement.name.name=/^Round(Button|Link)$/] JSXOpeningElement[name.name='svg'] > JSXAttribute[name.name=/^(width|height|style)$/]",
          message: "RoundButton 안 svg 의 크기는 버튼의 size 가 정한다. width·height·style 을 두지 않는다.",
        },
        {
          selector: "Literal[value='postgres_changes']",
          message: "실시간은 내용 없는 broadcast 알림 + 재조회로 한다(docs/adr/0010). postgres_changes 로 votes 를 구독하면 익명 모드가 뚫린다.",
        },
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
          {
            selector: `:matches(JSXOpeningElement[name.name=/^(Button|IconButton|Chip|RoundButton|RoundLink|RoundRow|ListRowButton|ListRowLink)$/] > JSXAttribute[name.name='className'], CallExpression[callee.name='buttonClassName'] Property[key.name='className']) ${node}${CONTROL_SIZE_UTILITY}]`,
            message:
              "Button·IconButton·Chip·RoundButton·ListRowButton·ListRowLink·buttonClassName 의 높이·폭·안쪽 여백·모서리·글자 크기는 size·variant prop 이나 " +
              "부품이 정한다. className 에는 바깥 배치만 둔다" +
              "(m*·flex-1·shrink-0·self-*·order-*·hidden 같은 표시 여부). 꽉 찬 폭은 Button 의 fullWidth, 툴바 동작은 ToolbarButton 을 쓴다.",
          },
          {
            selector: `JSXOpeningElement[name.name=/^Round(Button|Link)$/] > JSXAttribute[name.name='className'] ${node}${ROUND_SKIN_UTILITY}]`,
            message:
              "RoundButton·RoundLink 의 색·테두리·그림자·눌림은 tone 이, 글리프를 내용 끝에 맞추는 자리는 edge 가 정한다. className 에는 바깥 배치만 둔다.",
          },
          {
            selector: `JSXElement[openingElement.name.name=/^Round(Button|Link)$/] JSXOpeningElement[name.name='svg'] > JSXAttribute[name.name='className'] ${node}${GLYPH_PLACEMENT_UTILITY}]`,
            message: "RoundButton 안 svg 의 크기와 자리는 버튼의 size 가 정한다. svg 에는 색만 둔다. 재생 삼각형은 PlayPauseIcon 을 쓴다.",
          },
        ]),
      ],
    },
  },
  {
    // A <button>, button-looking link or text field drawn outside the primitives picks its own height, radius and font
    // size, which is how mismatched controls kept shipping.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**", "src/**/__tests__/**"],
    rules: { "ds/no-raw-control": "error", "ds/no-raw-input": "error" },
  },
  {
    // globals.css draws the keyboard focus outline in @layer base, so an outline-none utility beats it. A class list that
    // removes the outline draws its own focus ring, or Tab moves focus where nobody can see it.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/__tests__/**"],
    rules: { "ds/focus-ring": "error" },
  },
]);

export default eslintConfig;
