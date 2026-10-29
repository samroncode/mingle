import { useState } from "react";
import { getMyBill } from "@/api/costs";
import { useLoad } from "@/hooks/useLoad";
import { isBillUpdated } from "@/lib/guest/bill";
import type { MyBill } from "@/lib/schemas/bill";

/**
 * The guest's own bill, read again whenever `signal` changes (the event's
 * costs version, or who is in the party). Null while the host hasn't sent the
 * bill, and when it can't be read. `updated` is true when the total has
 * changed since the guest last opened the bill; `markSeen` clears it.
 */
export function useMyBill(eventId: string, signal: number) {
  const load = useLoad(`bill:${eventId}`, () => getMyBill(eventId), {
    refresh: signal,
    keepOnError: true,
  });
  const bill: MyBill | null = load.status === "ready" ? load.value : null;
  const total = bill?.total ?? null;

  // The total the guest has seen, set when the bill first appears (adjusting
  // state while rendering).
  const [seenTotal, setSeenTotal] = useState<number | null>(null);
  if (total === null && seenTotal !== null) setSeenTotal(null);
  if (total !== null && seenTotal === null) setSeenTotal(total);

  return {
    bill,
    updated: isBillUpdated(seenTotal, total),
    markSeen: () => setSeenTotal(total),
  };
}
