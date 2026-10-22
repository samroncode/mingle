import { expect, test } from "@playwright/test";
import { fakeEvent, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
type SignIn = { gotrue_meta_security?: { captcha_token?: string } };
const hostKey = "b".repeat(43);

test("a failed CAPTCHA shows a retry message, and retrying signs in with the token", async ({
  page,
}) => {
  const signIns: SignIn[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/auth/v1/signup")
    ) {
      signIns.push(request.postDataJSON() as SignIn);
    }
  });
  await fakeSupabase(page, [], { captchaFailures: 1 });
  await fakeEvent(page, { code });

  await page.goto(`/p/${code}`);
  await expect(
    page.getByRole("heading", { name: "We couldn't check your device" }),
  ).toBeVisible();
  // The failed check never reached sign-in.
  expect(signIns).toEqual([]);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  expect(signIns).toHaveLength(1);
  expect(signIns[0]?.gotrue_meta_security?.captcha_token).toBe("fake-token");
});

test("the host door shows the CAPTCHA message and can try again", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]], { captchaFailures: 1 });
  await page.goto(`/host/${code}#key=${hostKey}`);
  await expect(page.getByRole("alert")).toContainText(
    "check that you're a real person",
  );

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
});
