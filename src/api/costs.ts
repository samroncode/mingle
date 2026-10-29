import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

/** A purchase and who shares it, as the host reads it. */
export interface PurchaseView {
  id: string;
  name: string;
  /** Whole kronor. */
  price: number;
  /** User ids of everyone who was made a sharer, removed guests included. */
  sharers: string[];
}

/** The event's shared costs, as the host reads them. */
export interface CostsView {
  payeeName: string;
  /** Normalised, e.g. 46701234567. */
  swishNumber: string;
  purchases: PurchaseView[];
}

/**
 * The event's shared costs, or null while they are switched off. Only the
 * host's own read returns anything: for a guest and the TV, RLS shows no row,
 * so they get null too.
 */
export async function getCosts(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<CostsView | null, "unknown">> {
  const [settings, purchases, sharers] = await Promise.all([
    client
      .from("cost_settings")
      .select("payee_name, swish_number")
      .eq("event_id", eventId)
      .maybeSingle(),
    client
      .from("cost_purchases")
      .select("id, name, price_kr")
      .eq("event_id", eventId)
      .order("position"),
    client
      .from("cost_sharers")
      .select("purchase_id, user_id")
      .eq("event_id", eventId),
  ]);
  if (settings.error || purchases.error || sharers.error)
    return fail("unknown");
  if (!settings.data) return ok(null);

  return ok({
    payeeName: settings.data.payee_name,
    swishNumber: settings.data.swish_number,
    purchases: purchases.data.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price_kr,
      sharers: sharers.data
        .filter((sharer) => sharer.purchase_id === row.id)
        .map((sharer) => sharer.user_id),
    })),
  });
}
