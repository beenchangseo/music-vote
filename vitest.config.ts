import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // next build swaps in the app-router next/dynamic (React.lazy, suspends). The package default is the pages-router
      // one, which draws an empty placeholder instead, so tests would check a loading screen that never ships.
      "next/dynamic": "next/dist/api/app-dynamic",
    },
  },
  test: {
    // Playwright specs (npm run test:e2e) use the same *.spec.ts naming; keep them out of vitest.
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/worktrees/**"],
  },
});
