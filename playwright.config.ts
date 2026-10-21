import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Cloud sessions ship a preinstalled Chromium; on a desktop, run
// `npx playwright install chromium` and this falls back to Playwright's own.
const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(preinstalledChromium) ? preinstalledChromium : undefined);

const port = 5174;

export default defineConfig({
  testDir: "e2e",
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${port}`,
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // The tests fake every Supabase answer, so these only need to be valid.
    env: {
      VITE_SUPABASE_URL: "http://localhost:54399",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_fake",
    },
  },
});
