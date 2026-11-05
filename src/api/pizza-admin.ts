import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import { logError } from "./log";
import { ensureAnonymousSession, type AppClient } from "./session";

/** Why an admin call failed; the UI maps each to an i18n key. */
export type PizzaAdminErrorCode =
  "forbidden" | "rate_limited" | "not_found" | "network_error" | "unknown";

export interface AdminPizzaOrder {
  id: string;
  name: string;
  pizza: string;
  note: string | null;
  done: boolean;
  /** ISO time the order came in. */
  createdAt: string;
}

const knownCodes: readonly PizzaAdminErrorCode[] = [
  "forbidden",
  "rate_limited",
  "not_found",
];

function toCode(value: unknown): PizzaAdminErrorCode {
  return knownCodes.find((code) => code === value) ?? "unknown";
}

function isOrderRow(value: unknown): value is {
  id: string;
  name: string;
  pizza: string;
  note: string | null;
  done: boolean;
  created_at: string;
} {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.pizza === "string" &&
    (row.note === null || typeof row.note === "string") &&
    typeof row.done === "boolean" &&
    typeof row.created_at === "string"
  );
}

/** Signs in if needed and runs one RPC. Logs codes only, never the key. */
async function call<T>(
  action: string,
  client: AppClient,
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<Result<T, PizzaAdminErrorCode>> {
  const session = await ensureAnonymousSession(client);
  if (!session.ok) {
    void logError({ area: "pizza_admin", action, code: session.error });
    return fail("network_error");
  }
  const { data, error } = await run();
  if (error || data === null) {
    void logError({ area: "pizza_admin", action, code: "network_error" });
    return fail("network_error");
  }
  return ok(data);
}

function toStatus(
  action: string,
  data: string,
): Result<true, PizzaAdminErrorCode> {
  if (data === "ok") return ok(true);
  const code = toCode(data);
  if (code === "unknown") {
    void logError({ area: "pizza_admin", action, code });
  }
  return fail(code);
}

/** All orders, newest first. A wrong key answers `forbidden`. */
export async function listPizzaOrders(
  adminKey: string,
  client: AppClient = getSupabase(),
): Promise<Result<AdminPizzaOrder[], PizzaAdminErrorCode>> {
  const result = await call("list", client, () =>
    client.rpc("pizza_admin_orders", { admin_key: adminKey }),
  );
  if (!result.ok) return result;
  const body = result.value as { error?: unknown; orders?: unknown } | null;
  if (body && typeof body === "object" && "error" in body) {
    return fail(toCode(body.error));
  }
  if (!body || !Array.isArray(body.orders) || !body.orders.every(isOrderRow)) {
    void logError({ area: "pizza_admin", action: "list", code: "unknown" });
    return fail("unknown");
  }
  return ok(
    body.orders.map((row) => ({
      id: row.id,
      name: row.name,
      pizza: row.pizza,
      note: row.note,
      done: row.done,
      createdAt: row.created_at,
    })),
  );
}

export async function setPizzaOrderDone(
  adminKey: string,
  orderId: string,
  done: boolean,
  client: AppClient = getSupabase(),
): Promise<Result<true, PizzaAdminErrorCode>> {
  const result = await call("set_done", client, () =>
    client.rpc("pizza_admin_set_done", {
      admin_key: adminKey,
      order_id: orderId,
      done,
    }),
  );
  return result.ok ? toStatus("set_done", result.value) : result;
}

export async function deletePizzaOrder(
  adminKey: string,
  orderId: string,
  client: AppClient = getSupabase(),
): Promise<Result<true, PizzaAdminErrorCode>> {
  const result = await call("delete", client, () =>
    client.rpc("pizza_admin_delete", {
      admin_key: adminKey,
      order_id: orderId,
    }),
  );
  return result.ok ? toStatus("delete", result.value) : result;
}

export async function clearPizzaOrders(
  adminKey: string,
  client: AppClient = getSupabase(),
): Promise<Result<true, PizzaAdminErrorCode>> {
  const result = await call("clear", client, () =>
    client.rpc("pizza_admin_clear", { admin_key: adminKey }),
  );
  return result.ok ? toStatus("clear", result.value) : result;
}
