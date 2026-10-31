import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Playwright specs (npm run test:e2e) use the same *.spec.ts naming; keep them out of vitest.
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/worktrees/**"],
    env: { OG_SIGNING_SECRET: "vitest-og-signing-secret-0123456789abcdef" },
  },
});
