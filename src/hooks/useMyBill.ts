import { useEffect, useState } from "react";
import { getMyBill } from "@/api/costs";
import { logError } from "@/api/log";
import { useLoad } from "@/hooks/useLoad";
import { isBillUpdated } from "@/lib/guest/bill";
import type { MyBill } from "@/lib/schemas/bill";

/**
 * The guest's own bill, read again whenever `signal` changes (the event's
 * costs version, or who is in the party). Null while the host hasn't sent the
 * bill. `failed` is true when the bill couldn't be read (and is logged once
 * per failure), so the guest can be told and retry. `updated` is true when the total has
 * changed since the guest last opened the bill; `markSeen` clears it, and
 * `reload` reads the bill again.
 */
export function useMyBill(eventId: string, signal: number) {
  // Bumped after the guest's own change, so the bill is read again at once.
  const [reloads, setReloads] = useState(0);
  const load = useLoad(`bill:${eventId}`, () => getMyBill(eventId), {
    refresh: signal * 1000 + reloads,
    keepOnError: true,
  });
  const bill: MyBill | null = load.status === "ready" ? load.value : null;
  const total = bill?.total ?? null;
  const failed = load.status === "error";
  useEffect(() => {
    if (failed)
      void logError({
        area: "costs",
        action: "load_bill",
        code: "load_failed",
      });
  }, [failed]);

  // The total the guest has seen, set when the bill first appears (adjusting
  // state while rendering).
  const [seenTotal, setSeenTotal] = useState<number | null>(null);
  if (total === null && seenTotal !== null) setSeenTotal(null);
  if (total !== null && seenTotal === null) setSeenTotal(total);

  return {
    bill,
    failed,
    updated: isBillUpdated(seenTotal, total),
    markSeen: () => setSeenTotal(total),
    reload: () => setReloads((count) => count + 1),
  };
}
