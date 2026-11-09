import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getCosts } from "@/api/costs";
import type { EventRow, MemberRow } from "@/api/events";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { costsTotals, formatKr } from "@/lib/costs/shares";
import { idsSignal } from "@/lib/guest/bill";
import { sortedGuests } from "@/lib/host/guest-list";
import { SharedCosts } from "../SharedCosts";

/**
 * The shared costs in one line: what was spent and what is left to collect.
 * Open shows the existing costs section in place, with every action in it.
 */
export function CostsBlock({
  event,
  members,
  hostKey,
}: {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const guestIds = sortedGuests(members, event.language).map((g) => g.userId);
  const load = useLoad(`costs:${event.id}`, () => getCosts(event.id), {
    refresh: event.costs_version + idsSignal(guestIds),
    keepOnError: true,
  });
  const costs = load.status === "ready" ? load.value : null;
  const totals =
    costs && costsTotals(costs.purchases, new Set(guestIds), costs.payments);
  return (
    <div className="space-y-2">
      <p data-testid="costs-summary" className="text-ink">
        {load.status === "error"
          ? t("hostPanel.costs.loadFailed")
          : load.status === "loading"
            ? t("hostPanel.loading")
            : !costs || !totals
              ? t("hostPanel.costs.off")
              : t("hostPanel.costs.totals", {
                  spent: formatKr(totals.spent),
                  owed: formatKr(totals.owed),
                })}
      </p>
      {costs && (
        <p className="text-sm text-ink-muted">
          {t(
            costs.billSentAt
              ? "hostPanel.costs.billSentSummary"
              : "hostPanel.costs.billNotSentSummary",
          )}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(
          open ? "hostPanel.dashboard.close" : "hostPanel.dashboard.costsOpen",
        )}
      </Button>
      {open && (
        <SharedCosts
          eventId={event.id}
          code={event.code}
          hostKey={hostKey}
          members={members}
          language={event.language}
          costsVersion={event.costs_version}
          defaultOpen
        />
      )}
    </div>
  );
}
