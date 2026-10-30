import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type CostsView, getCosts } from "@/api/costs";
import type { MemberRow } from "@/api/events";
import { updateCosts } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/PanelSection";
import { useHostAction } from "@/hooks/useHostAction";
import { useLoad } from "@/hooks/useLoad";
import {
  costsToForm,
  nationalNumber,
  newPurchaseForm,
  type CostsForm,
} from "@/lib/costs/costs-form";
import {
  costsTotals,
  currentSharers,
  formatKr,
  shareOf,
} from "@/lib/costs/shares";
import { idsSignal } from "@/lib/guest/bill";
import { sortedGuests } from "@/lib/host/guest-list";
import { BillControl } from "./BillControl";
import { CostsEditor } from "./CostsEditor";
import { GuestPayments } from "./GuestPayments";
import { RemovedPayers } from "./RemovedPayers";

interface SharedCostsProps {
  eventId: string;
  code: string;
  hostKey: string;
  members: MemberRow[];
  language: string;
  /** The event's `costs_version`; it changes when a guest says they paid. */
  costsVersion: number;
}

function PurchaseList({
  costs,
  guestIds,
}: {
  costs: CostsView;
  guestIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  if (costs.purchases.length === 0) {
    return (
      <p className="text-on-paper-muted">{t("hostPanel.costs.noPurchases")}</p>
    );
  }
  return (
    <ul className="space-y-2">
      {costs.purchases.map((purchase) => {
        const count = currentSharers(purchase, guestIds).length;
        return (
          <li
            key={purchase.id}
            className="rounded-md border-[length:var(--border-thin)] border-edge p-3"
          >
            <p className="flex justify-between gap-2 font-display font-bold">
              <span className="min-w-0 break-words">{purchase.name}</span>
              <span className="shrink-0">{formatKr(purchase.price)}</span>
            </p>
            <p className="text-sm text-on-paper-muted">
              {count === 0
                ? t("hostPanel.costs.nobodyShares")
                : t("hostPanel.costs.shareLine", {
                    count,
                    share: formatKr(shareOf(purchase.price, count)),
                  })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function SwitchOff({
  code,
  hostKey,
  onDone,
}: {
  code: string;
  hostKey: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useHostAction();

  async function switchOff() {
    const result = await run(() =>
      updateCosts({ code, key: hostKey, costs: null }),
    );
    if (result.ok) onDone();
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        {t("hostPanel.costs.switchOff")}
      </Button>
    );
  }
  return (
    <div
      role="alertdialog"
      aria-label={t("hostPanel.costs.switchOff")}
      className="space-y-3 rounded-md border-[length:var(--border-thin)] border-danger p-3 text-on-paper"
    >
      <p className="text-base">{t("hostPanel.costs.switchOffConfirm")}</p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void switchOff()}
        >
          {t("hostPanel.costs.switchOffAction")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          {t("hostPanel.costs.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The host's shared costs, small and closed to start with: the Swish number,
 * who guests pay, and the purchases with who shares each. Only the host can
 * read this; nothing about it reaches guests or the TV yet.
 */
export function SharedCosts({
  eventId,
  code,
  hostKey,
  members,
  language,
  costsVersion,
}: SharedCostsProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<CostsForm>();
  const [refresh, setRefresh] = useState(0);
  const guests = sortedGuests(members, language);
  const guestIds = guests.map((guest) => guest.userId);
  // Read again when the host changes something, a guest says they paid, or
  // the guests change: a removed guest leaves a note if they had paid.
  const load = useLoad(`costs:${eventId}`, () => getCosts(eventId), {
    refresh: refresh + costsVersion + idsSignal(guestIds),
    keepOnError: true,
  });
  const costs = load.status === "ready" ? load.value : null;

  const startEditing = (addPurchase = false) => {
    const form = costsToForm(costs, guestIds);
    setEditing(
      addPurchase
        ? { ...form, purchases: [...form.purchases, newPurchaseForm(guestIds)] }
        : form,
    );
  };
  const done = () => {
    setEditing(undefined);
    setRefresh((count) => count + 1);
  };

  const totals =
    costs && costsTotals(costs.purchases, new Set(guestIds), costs.payments);
  const summary = !costs
    ? undefined
    : [
        costs.billSentAt
          ? t("hostPanel.costs.billSentSummary")
          : t("hostPanel.costs.billNotSentSummary"),
        totals &&
          t("hostPanel.costs.totals", {
            spent: formatKr(totals.spent),
            owed: formatKr(totals.owed),
          }),
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <PanelSection
      testId="host-costs"
      title={t("hostPanel.costs.title")}
      summary={summary}
    >
      {load.status === "error" && (
        <ErrorLine>{t("hostPanel.costs.loadFailed")}</ErrorLine>
      )}
      {load.status === "loading" && (
        <p className="text-on-paper-muted">{t("hostPanel.loading")}</p>
      )}
      {load.status === "ready" && editing && (
        <CostsEditor
          code={code}
          hostKey={hostKey}
          guests={guests}
          initial={editing}
          onDone={done}
          onCancel={() => setEditing(undefined)}
        />
      )}
      {load.status === "ready" && !editing && !costs && (
        <>
          <p className="text-on-paper-muted">{t("hostPanel.costs.off")}</p>
          <Button size="sm" onClick={() => startEditing()}>
            {t("hostPanel.costs.switchOn")}
          </Button>
        </>
      )}
      {load.status === "ready" && !editing && costs && (
        <>
          <BillControl
            code={code}
            hostKey={hostKey}
            sent={costs.billSentAt !== null}
            onDone={done}
          />
          <p className="text-base">
            {t("hostPanel.costs.payeeLine", {
              name: costs.payeeName,
              number: nationalNumber(costs.swishNumber),
            })}
          </p>
          <PurchaseList costs={costs} guestIds={new Set(guestIds)} />
          <RemovedPayers payers={costs.removedPayers} />
          <GuestPayments
            costs={costs}
            guests={guests}
            code={code}
            hostKey={hostKey}
            onDone={done}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => startEditing(true)}>
              {t("hostPanel.costs.addPurchase")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => startEditing()}>
              {t("hostPanel.costs.edit")}
            </Button>
          </div>
          <SwitchOff code={code} hostKey={hostKey} onDone={done} />
        </>
      )}
    </PanelSection>
  );
}
