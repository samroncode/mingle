import { useTranslation } from "react-i18next";
import type { CostsView } from "@/api/costs";
import { setPayment } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import { paymentStatus } from "@/lib/costs/payments";
import { formatKr, guestTotals, owedOf } from "@/lib/costs/shares";
import type { ListedGuest } from "@/lib/host/guest-list";

interface GuestPaymentsProps {
  costs: CostsView;
  guests: ListedGuest[];
  code: string;
  hostKey: string;
  onDone: () => void;
}

function GuestPaymentRow({
  guest,
  total,
  costs,
  code,
  hostKey,
  onDone,
}: {
  guest: ListedGuest;
  total: number;
  costs: CostsView;
  code: string;
  hostKey: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();
  const payment = costs.payments.get(guest.userId);
  const status = paymentStatus(total, payment);

  async function change(next: "confirm" | "undo") {
    const result = await run(() =>
      setPayment({ code, key: hostKey, userId: guest.userId, change: next }),
    );
    if (result.ok) onDone();
  }

  const label = {
    owes: t("hostPanel.costs.statusOwes"),
    says_paid: t("hostPanel.costs.statusSaysPaid"),
    paid: t("hostPanel.costs.statusPaid"),
  }[status];
  return (
    <li
      data-testid="guest-payment"
      data-status={status}
      className="space-y-1 border-b-[length:var(--border-thin)] border-edge py-2 last:border-b-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words">{guest.name}</span>
        <span className="shrink-0">
          {formatKr(total)} ·{" "}
          <span className="font-bold" data-testid="payment-status">
            {label}
          </span>
        </span>
      </div>
      {status === "owes" && payment?.confirmedKr != null && (
        <p className="text-sm text-on-paper-muted">
          {t("hostPanel.costs.paidAmount", {
            amount: formatKr(payment.confirmedKr),
          })}
          {" · "}
          {t("hostPanel.costs.owesAmount", {
            amount: formatKr(owedOf(total, payment)),
          })}
        </p>
      )}
      {error && <ErrorLine>{t("hostPanel.costs.paymentFailed")}</ErrorLine>}
      <div className="flex gap-2">
        {status === "says_paid" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void change("confirm")}
          >
            {t("hostPanel.costs.confirm")}
          </Button>
        )}
        {status === "owes" && total > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void change("confirm")}
          >
            {t("hostPanel.costs.markPaid")}
          </Button>
        )}
        {(status === "paid" ||
          payment?.saysPaid ||
          payment?.confirmedKr != null) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void change("undo")}
          >
            {t("hostPanel.costs.undoPayment")}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Every guest with their total and where they stand: Owes, Says paid, Paid.
 * The host confirms an "I've paid" once the money shows up in Swish, marks a
 * guest paid directly (cash), and undoes a mistaken confirmation.
 */
export function GuestPayments({
  costs,
  guests,
  code,
  hostKey,
  onDone,
}: GuestPaymentsProps) {
  const { t } = useTranslation();
  const totals = guestTotals(
    costs.purchases,
    guests.map((guest) => guest.userId),
  );
  if (guests.length === 0 || costs.purchases.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="font-display font-bold">
        {t("hostPanel.costs.perGuest")}
      </h3>
      <ul className="text-base">
        {guests.map((guest) => (
          <GuestPaymentRow
            key={guest.userId}
            guest={guest}
            total={totals.get(guest.userId) ?? 0}
            costs={costs}
            code={code}
            hostKey={hostKey}
            onDone={onDone}
          />
        ))}
      </ul>
    </div>
  );
}
