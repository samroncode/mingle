import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import { logError } from "./log";
import { ensureAnonymousSession, type AppClient } from "./session";

/** Why an order wasn't saved; the UI maps each to an i18n key. */
export type PizzaOrderErrorCode =
  "invalid" | "rate_limited" | "network_error" | "unknown";

export interface PizzaOrder {
  name: string;
  pizzaNumber: string;
  pizza: string;
  note?: string;
}

/**
 * Sends one pizza order. The page has no event, so the device signs in
 * anonymously first. The owner reads orders in the Supabase table editor.
 */
export async function submitPizzaOrder(
  order: PizzaOrder,
  client: AppClient = getSupabase(),
): Promise<Result<true, PizzaOrderErrorCode>> {
  const session = await ensureAnonymousSession(client);
  if (!session.ok) {
    void logError({ area: "pizza", action: "sign_in", code: session.error });
    return fail("network_error");
  }
  const { data, error } = await client.rpc("submit_pizza_order", {
    name: order.name,
    pizza_number: order.pizzaNumber,
    pizza: order.pizza,
    note: order.note,
  });
  if (error) {
    void logError({ area: "pizza", action: "submit", code: "unknown" });
    return fail("network_error");
  }
  if (data === "ok") return ok(true);
  if (data === "invalid" || data === "rate_limited") return fail(data);
  void logError({ area: "pizza", action: "submit", code: "unknown" });
  return fail("unknown");
}
