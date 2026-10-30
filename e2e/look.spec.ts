import { expect, test, type Page } from "@playwright/test";
import { fakeNotices } from "./fake-notices.ts";
import { eventRow, memberRow } from "./fake-rows.ts";
import {
  fakeRun,
  runEvent,
  type RunModule,
  type RunScreen,
} from "./fake-run.ts";
import {
  fakeEvent,
  fakeHostPanel,
  fakeSupabase,
  fakeTv,
  supabase,
} from "./fake-supabase.ts";

// Checks the rules in docs/design.md that a browser can prove: no sideways
// scroll on any screen and phone tap targets of at least 48px, in every niche
// theme (aw = garden, team = loud, bachelor = garden with blush leading).
// The quiz, awards and hot takes screens are checked on the phone and the TV in
// each niche, for an open item, a revealed one and the closing step.

const code = "ABC234";
const niches = ["aw", "team", "bachelor"] as const;
const phone = { width: 412, height: 915 };
const tv = { width: 1920, height: 1080 };

async function expectNoHorizontalScroll(page: Page) {
  // A string expression, because the e2e tsconfig has no DOM types.
  const overflow = await page.evaluate<number>(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectTapTargetsAtLeast48px(page: Page) {
  const buttons = await page
    .locator("button:visible, [role='button']:visible")
    .all();
  const tooSmall: string[] = [];
  for (const button of buttons) {
    const box = await button.boundingBox();
    // A switch is 32px tall but has an invisible 8px tap area on every side.
    const hitArea = (await button.getAttribute("role")) === "switch" ? 16 : 0;
    if (box && box.height + hitArea < 47.5) {
      tooSmall.push(`${(await button.innerText()).trim()} (${box.height}px)`);
    }
  }
  expect(tooSmall).toEqual([]);
}

const modules: Array<{ id: RunModule; end: string; open: string }> = [
  { id: "quiz", open: "open", end: "results" },
  { id: "awards", open: "category", end: "winners" },
  { id: "hottakes", open: "take", end: "summary" },
];
const screens: RunScreen[] = ["open", "revealed", "end"];

/** The `data-screen` a module's view shows for a step. */
function screenName(module: (typeof modules)[number], screen: RunScreen) {
  if (screen === "end") return module.end;
  if (screen === "revealed" && module.id === "quiz") return "revealed";
  return module.open;
}

test.describe("phone size", () => {
  test.use({ viewport: phone });

  test("the landing page fits and has big buttons", async ({ page }) => {
    await fakeSupabase(page, []);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTapTargetsAtLeast48px(page);
  });

  for (const niche of niches) {
    test(`the guest join and lobby fit and have big buttons (${niche})`, async ({
      page,
    }) => {
      await fakeSupabase(page, []);
      await fakeEvent(page, { code, niche, joinAnswers: ["ok"] });
      await page.goto(`/p/${code}`);
      await expect(page.getByLabel("Your name")).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectTapTargetsAtLeast48px(page);

      await page.getByLabel("Your name").fill("Anna");
      await page.getByRole("button", { name: "Join" }).click();
      await expect(
        page.getByRole("heading", { name: "You're in, Anna!" }),
      ).toBeVisible();
      await expect(page.locator("[data-niche]")).toHaveAttribute(
        "data-niche",
        niche,
      );
      await expectNoHorizontalScroll(page);
      await expectTapTargetsAtLeast48px(page);
    });
  }

  for (const niche of niches) {
    for (const module of modules) {
      for (const screen of screens) {
        test(`the ${module.id} ${screen} screen fits and has big buttons (${niche})`, async ({
          page,
        }) => {
          await fakeSupabase(page, []);
          await fakeEvent(page, { code, niche, joinedAs: "Anna" });
          await page.route(`${supabase}/rest/v1/events*`, (route) => {
            if (!route.request().url().includes("id=eq.")) {
              return route.fallback();
            }
            return route.fulfill({
              status: 200,
              headers: {
                "access-control-allow-origin": "*",
                "content-type": "application/json",
              },
              body: JSON.stringify([runEvent(code, niche, module.id, screen)]),
            });
          });
          await fakeRun(page, screen);
          await page.goto(`/p/${code}`);
          await expect(page.getByTestId(`${module.id}-guest`)).toHaveAttribute(
            "data-screen",
            screenName(module, screen),
          );
          await expect(page.getByRole("heading").first()).toBeVisible();
          await expectNoHorizontalScroll(page);
          await expectTapTargetsAtLeast48px(page);
        });
      }
    }
  }
});

/** Saves a screenshot when SHOT_DIR is set: for the before/after in a PR. */
async function shoot(page: Page, name: string) {
  const dir = process.env.SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

const costsLanguages = [
  { language: "en", sheetTitle: "Pay Sam" },
  { language: "sv", sheetTitle: "Betala Sam" },
] as const;
const costsNiches = ["aw", "team"] as const;
const hostKey = "d".repeat(43);
const annaId = "00000000-0000-4000-8000-0000000000a1";
const bertilId = "00000000-0000-4000-8000-0000000000b2";

test.describe("shared costs, phone size", () => {
  test.use({ viewport: phone });

  for (const niche of costsNiches) {
    for (const { language, sheetTitle } of costsLanguages) {
      test(`the receipt icon and the bill sheet fit and have big buttons (${niche}, ${language})`, async ({
        page,
      }) => {
        await fakeSupabase(page, []);
        await fakeEvent(page, {
          code,
          niche,
          language,
          joinedAs: "Anna",
          bill: {
            payeeName: "Sam",
            swishNumber: "46701234567",
            total: 345,
            confirmed: 0,
            owed: 345,
            status: "owes",
            lines: [
              { name: "Drinks", share: 225 },
              { name: "Cake", share: 120 },
            ],
          },
        });
        await page.goto(`/p/${code}`);
        await expect(page.getByTestId("bill-icon")).toBeVisible();
        await expectNoHorizontalScroll(page);
        await shoot(page, `guest-icon-${niche}-${language}`);

        await page.getByTestId("bill-icon").click();
        await expect(page.getByTestId("bill-sheet")).toContainText(sheetTitle);
        await expectNoHorizontalScroll(page);
        await expectTapTargetsAtLeast48px(page);
        await shoot(page, `guest-sheet-${niche}-${language}`);
      });

      test(`the host's shared costs section fits and has big buttons (${niche}, ${language})`, async ({
        page,
      }) => {
        await fakeSupabase(page, [() => [200, {}]]);
        await fakeHostPanel(page, {
          code,
          language,
          enabledModules: [],
          flow: { niche },
          guests: [
            memberRow({ user_id: annaId, display_name: "Anna" }),
            memberRow({ user_id: bertilId, display_name: "Bertil" }),
          ],
          costs: {
            payeeName: "Sam",
            swishNumber: "46701234567",
            billSentAt: "2026-10-29T20:00:00Z",
            purchases: [
              {
                id: "p1",
                name: "Drinks",
                price: 450,
                sharers: [annaId, bertilId],
              },
            ],
            payments: { [annaId]: { saysPaid: true } },
            removedPayers: [{ userId: "c3", name: "Cecilia", paidKr: 120 }],
          },
        });
        await page.goto(`/host/${code}#key=${hostKey}`);
        const section = page.getByTestId("host-costs");
        await section.getByRole("button").first().click();
        await expect(section.getByTestId("removed-payers")).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectTapTargetsAtLeast48px(page);
        await shoot(page, `host-section-${niche}-${language}`);
      });
    }
  }
});

test.describe("host messages, phone size", () => {
  test.use({ viewport: phone });

  for (const niche of niches) {
    for (const language of ["en", "sv"] as const) {
      test(`the message banner and the Messages list fit and have big buttons (${niche}, ${language})`, async ({
        page,
      }) => {
        await fakeSupabase(page, []);
        await fakeEvent(page, { code, niche, language, joinedAs: "Anna" });
        await fakeNotices(page, () => [
          {
            id: "n1",
            text: "Dinner is served",
            created_at: "2026-10-22T11:00:00Z",
          },
          {
            id: "n2",
            text: "Taxi leaves at 01:00 from the front door, so be there",
            created_at: "2026-10-22T12:00:00Z",
          },
        ]);
        await page.goto(`/p/${code}`);
        await expect(page.getByTestId("notice-banner")).toBeVisible();
        await expect(page.getByTestId("notice-list")).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectTapTargetsAtLeast48px(page);
        await shoot(page, `guest-notices-${niche}-${language}`);
      });
    }
  }
});

test.describe("1920x1080", () => {
  test.use({ viewport: tv });

  test("the landing page fits", async ({ page }) => {
    await fakeSupabase(page, []);
    await page.goto("/");
    await expectNoHorizontalScroll(page);
  });

  for (const niche of niches) {
    test(`the guest view fits (${niche})`, async ({ page }) => {
      await fakeSupabase(page, []);
      await fakeEvent(page, { code, niche, joinedAs: "Anna" });
      await page.goto(`/p/${code}`);
      await expect(
        page.getByRole("heading", { name: "You're in, Anna!" }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test(`the TV party screen fits and uses the niche theme (${niche})`, async ({
      page,
    }) => {
      await fakeSupabase(page, []);
      await fakeTv(page, {
        snapshot: {
          ...eventRow({
            id: "e1",
            code,
            niche,
            party: { welcome: "Welcome!" },
          }),
          members: [
            memberRow({ user_id: "t", role: "tv", display_name: null }),
            memberRow({ user_id: "g1", role: "guest", display_name: "Anna" }),
          ],
        },
      });
      await page.goto(`/tv/${code}`);
      await expect(page.getByTestId("tv-code")).toHaveText(code);
      await expect(page.locator("[data-niche]")).toHaveAttribute(
        "data-niche",
        niche,
      );
      await expectNoHorizontalScroll(page);
    });

    test(`the TV winners slide fits and reads big (${niche})`, async ({
      page,
    }) => {
      await fakeSupabase(page, []);
      await fakeTv(page, {
        snapshot: {
          ...eventRow({
            id: "e1",
            code,
            niche,
            party: {
              winners: [
                { title: "Dart tournament", name: "Anna" },
                { title: "Best costume", name: "Bertil and Cissi" },
              ],
            },
          }),
          members: [
            memberRow({ user_id: "t", role: "tv", display_name: null }),
          ],
        },
      });
      await page.goto(`/tv/${code}`);
      await expect(page.getByTestId("winners")).toContainText("Anna");
      await expect(page.locator("[data-niche]")).toHaveAttribute(
        "data-niche",
        niche,
      );
      await expectNoHorizontalScroll(page);
      const smallest = await page.evaluate<number>(
        "Math.min(...[...document.querySelectorAll('[data-testid=winners] p')].map((el) => parseFloat(getComputedStyle(el).fontSize)))",
      );
      expect(smallest).toBeGreaterThanOrEqual(22);
      await shoot(page, `tv-winners-${niche}`);
    });

    for (const module of modules) {
      for (const screen of screens) {
        test(`the ${module.id} ${screen} TV screen fits (${niche})`, async ({
          page,
        }) => {
          await fakeSupabase(page, []);
          await fakeTv(page, {
            snapshot: runEvent(code, niche, module.id, screen),
          });
          await fakeRun(page, screen);
          await page.goto(`/tv/${code}`);
          await expect(page.getByTestId(`${module.id}-tv`)).toHaveAttribute(
            "data-screen",
            screenName(module, screen),
          );
          await expect(page.getByTestId(`${module.id}-tv`)).toBeVisible();
          await expectNoHorizontalScroll(page);
        });
      }
    }
  }

  test("a reveal gets a few seconds of party on the TV, then goes back to playful", async ({
    page,
  }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, { snapshot: runEvent(code, "aw", "quiz", "revealed") });
    await fakeRun(page, "revealed");
    await page.goto(`/tv/${code}`);
    await expect(page.getByTestId("confetti")).toBeAttached();
    await expect(page.locator("[data-fun='party']")).toHaveCount(1);
    await expect(page.locator("[data-fun='party']")).toHaveCount(0, {
      timeout: 8000,
    });
    await expect(page.getByTestId("confetti")).toHaveCount(0);
  });
});
