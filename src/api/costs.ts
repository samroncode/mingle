import { MyBillSchema, type MyBill } from "@/lib/schemas/bill";
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

/** What a guest has said or the host has confirmed, as the host reads it. */
export interface PaymentView {
  /** The guest says they paid and the host hasn't confirmed yet. */
  saysPaid: boolean;
  /** The total the host confirmed, or null. */
  confirmedKr: number | null;
}

/** The event's shared costs, as the host reads them. */
export interface CostsView {
  payeeName: string;
  /** Normalised, e.g. 46701234567. */
  swishNumber: string;
  /** Null while the bill is hidden; guests see nothing until it is sent. */
  billSentAt: string | null;
  purchases: PurchaseView[];
  /** By user id; a guest without an entry owes everything. */
  payments: Map<string, PaymentView>;
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
  const [settings, purchases, sharers, payments] = await Promise.all([
    client
      .from("cost_settings")
      .select("payee_name, swish_number, bill_sent_at")
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
    client
      .from("cost_payments")
      .select("user_id, says_paid_at, confirmed_kr")
      .eq("event_id", eventId),
  ]);
  if (settings.error || purchases.error || sharers.error || payments.error)
    return fail("unknown");
  if (!settings.data) return ok(null);

  return ok({
    payeeName: settings.data.payee_name,
    swishNumber: settings.data.swish_number,
    billSentAt: settings.data.bill_sent_at,
    purchases: purchases.data.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price_kr,
      sharers: sharers.data
        .filter((sharer) => sharer.purchase_id === row.id)
        .map((sharer) => sharer.user_id),
    })),
    payments: new Map(
      payments.data.map((row) => [
        row.user_id,
        {
          saysPaid: row.says_paid_at !== null,
          confirmedKr: row.confirmed_kr,
        },
      ]),
    ),
  });
}

/**
 * The calling guest's own bill, or null: until the host sends the bill, after
 * they hide it, and for anyone who isn't a current guest. The database never
 * answers more than the caller's own lines. A failed read is not an error the
 * guest needs to see: there is simply no bill to show.
 */
export async function getMyBill(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<MyBill | null, "unknown">> {
  const { data, error } = await client.rpc("my_bill", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  if (data === null) return ok(null);
  const parsed = MyBillSchema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unknown");
}

/** Why "I've paid" wasn't saved; the UI maps each to an i18n key. */
export type IPaidErrorCode =
  "not_sent" | "already_confirmed" | "not_found" | "unknown";

const iPaidRefusals: readonly IPaidErrorCode[] = [
  "not_sent",
  "already_confirmed",
  "not_found",
];

/**
 * The calling guest says they paid (`paid` true) or takes it back. The
 * database changes the caller's own row only, and refuses when the bill isn't
 * sent or the host has already confirmed everything.
 */
export async function setIPaid(
  eventId: string,
  paid: boolean,
  client: AppClient = getSupabase(),
): Promise<Result<null, IPaidErrorCode>> {
  const { data, error } = await client.rpc("set_i_paid", {
    target_event_id: eventId,
    paid,
  });
  if (error) return fail("unknown");
  if (data === "updated") return ok(null);
  return fail(iPaidRefusals.find((code) => code === data) ?? "unknown");
}
