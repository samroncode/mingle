import { expect, test, type Page } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, fakeTv } from "./fake-supabase.ts";

// Checks the rules in docs/design.md that a browser can prove: no sideways
// scroll on any screen and phone tap targets of at least 48px, in every niche
// theme (aw = garden, team = loud, bachelor = garden with blush leading).
// Quiz, awards and hot takes screens are added by ticket #130.

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
    if (box && box.height < 47.5) {
      tooSmall.push(`${(await button.innerText()).trim()} (${box.height}px)`);
    }
  }
  expect(tooSmall).toEqual([]);
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
  }
});
