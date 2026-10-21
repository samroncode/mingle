import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    unstubGlobals: true,
    unstubEnvs: true,
    // Vitest stubs CSS as empty by default; the niche tests read the real tokens.
    css: { include: [/src\/index\.css/] },
    // `npm run test` runs `unit` and needs no Docker. `npm run test:db` runs
    // `db` against the local Supabase stack (`npm run db:start`).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.db.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["**/*.db.test.ts"],
          exclude: ["node_modules/**"],
          // The db tests share one local database, so run files one at a time.
          fileParallelism: false,
          // Serves the Edge Functions for the tests that call them over HTTP.
          globalSetup: ["supabase/tests/functions-setup.ts"],
        },
      },
    ],
  },
});
