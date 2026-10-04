import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load `.env.local` then `.env` into process.env, same precedence as Next.js.
 * Values that are already set (shell, earlier file) are never overridden.
 * Uses the Node built-in loader so the gate adds no dotenv dependency.
 */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
