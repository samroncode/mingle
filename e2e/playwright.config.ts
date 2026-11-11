import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Cloud sessions ship a preinstalled Chromium; on a desktop, run
// `npx playwright install chromium` and this falls back to Playwright's own.
const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(preinstalledChromium) ? preinstalledChromium : undefined);

const port = 5174;

// Host specs that must pass on a phone and on a desktop screen. The "desktop"
// project runs exactly these at 1440 px; every spec runs in "phone". Specs that
// pick their own width (host-dashboard, host-side-column, host-phone) are not
// listed, they only run once. host-views and host-prepare read the width and
// check both layouts of Run and Prepare.
const bothWidths = [
  "host-panel",
  "host-activities",
  "host-messages",
  "host-guests",
  "competitions-spotlight",
  "host-views",
  "host-prepare",
].map((name) => new RegExp(`${name}\\.spec\\.ts$`));

export default defineConfig({
  testDir: ".",
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${port}`,
    launchOptions: { executablePath },
    // The app starts in Swedish for everyone; the tests read English texts, so
    // each test starts with English chosen, as a user would with the switcher.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${port}`,
          localStorage: [{ name: "mingle.language", value: "en" }],
        },
      ],
    },
  },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
    {
      name: "desktop",
      testMatch: bothWidths,
      use: {
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  webServer: {
    cwd: path.resolve(import.meta.dirname, ".."),
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // The tests fake every Supabase answer, so these only need to be valid.
    env: {
      VITE_SUPABASE_URL: "http://localhost:54399",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_fake",
      // A site key turns the CAPTCHA on; fakeSupabase fakes Cloudflare's side.
      VITE_TURNSTILE_SITE_KEY: "e2e-site-key",
    },
  },
});
