import { expect, test, type Page } from "@playwright/test";
import { fakeSupabase, supabase } from "./fake-supabase.ts";

const key = "k".repeat(43);

type Order = {
  id: string;
  name: string;
  pizza: string;
  note: string | null;
  done: boolean;
  created_at: string;
};

const order = (
  id: string,
  name: string,
  pizza: string,
  done = false,
): Order => ({
  id,
  name,
  pizza,
  note: id === "o1" ? "no onion" : null,
  done,
  created_at: "2026-11-05T18:00:00Z",
});

/** Fakes the pizza admin RPCs over a list the test can see; returns the call log. */
async function fakePizzaAdmin(page: Page, orders: Order[], forbidden = false) {
  const calls: string[] = [];
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
    "content-type": "application/json",
  };
  await page.route(`${supabase}/rest/v1/rpc/pizza_admin_*`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }
    const name = request.url().split("/").pop() ?? "";
    const body = request.postDataJSON() as {
      order_id?: string;
      done?: boolean;
    };
    calls.push(name);
    if (forbidden) {
      const answer =
        name === "pizza_admin_orders" ? { error: "forbidden" } : "forbidden";
      return route.fulfill({
        status: 200,
        headers: cors,
        body: JSON.stringify(answer),
      });
    }
    if (name === "pizza_admin_orders") {
      return route.fulfill({
        status: 200,
        headers: cors,
        body: JSON.stringify({ orders }),
      });
    }
    if (name === "pizza_admin_set_done") {
      const found = orders.find((o) => o.id === body.order_id);
      if (found) found.done = body.done === true;
    }
    if (name === "pizza_admin_delete") {
      const i = orders.findIndex((o) => o.id === body.order_id);
      if (i >= 0) orders.splice(i, 1);
    }
    if (name === "pizza_admin_clear") orders.length = 0;
    return route.fulfill({ status: 200, headers: cors, body: '"ok"' });
  });
  return calls;
}

test("the owner sees the orders and a count per pizza", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakePizzaAdmin(page, [
    order("o1", "Anna", "Capricciosa"),
    order("o2", "Bo", "capricciosa"),
    order("o3", "Cia", "Margherita"),
  ]);

  await page.goto(`/pizza/admin#key=${key}`);

  await expect(page.getByText("2 × Capricciosa")).toBeVisible();
  await expect(page.getByText("1 × Margherita")).toBeVisible();
  await expect(page.getByText("no onion")).toBeVisible();
});

test("marking an order as ordered takes it off the list to order", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakePizzaAdmin(page, [order("o3", "Cia", "Margherita")]);

  await page.goto(`/pizza/admin#key=${key}`);
  await expect(page.getByText("1 × Margherita")).toBeVisible();
  await page.getByRole("button", { name: "Mark as ordered" }).click();

  await expect(page.getByText("1 × Margherita")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Not ordered after all" }),
  ).toBeVisible();
});

test("deleting asks first, then removes the order", async ({ page }) => {
  await fakeSupabase(page, []);
  const calls = await fakePizzaAdmin(page, [order("o3", "Cia", "Margherita")]);

  await page.goto(`/pizza/admin#key=${key}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  expect(calls).not.toContain("pizza_admin_delete");
  await expect(page.getByText("Delete the order from Cia?")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page.getByText("No orders yet.")).toBeVisible();
});

test("a link with a wrong key shows that it doesn't work", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakePizzaAdmin(page, [], true);

  await page.goto(`/pizza/admin#key=${key}`);

  await expect(page.getByRole("alert")).toContainText("doesn't work");
});

test("a link with no key doesn't ask the server", async ({ page }) => {
  await fakeSupabase(page, []);
  const calls = await fakePizzaAdmin(page, []);

  await page.goto("/pizza/admin");

  await expect(page.getByRole("alert")).toContainText("doesn't work");
  expect(calls).toEqual([]);
});
