import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setIPaid } from "@/api/costs";
import { logError } from "@/api/log";
import { CatchBoundary } from "@/components/CatchBoundary";
import { ErrorLine } from "@/components/ErrorLine";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { nationalNumber } from "@/lib/costs/costs-form";
import { formatKr } from "@/lib/costs/shares";
import { swishAppLink, swishMessage, swishQrText } from "@/lib/guest/swish";
import { watchSwishOpen } from "@/lib/guest/swish-open";
import type { MyBill } from "@/lib/schemas/bill";
import { SheetFrame } from "./SheetFrame";

interface BillSheetProps {
  bill: MyBill;
  eventId: string;
  /** The event code and the guest's display name, for the Swish message. */
  code: string;
  guestName: string;
  updated: boolean;
  /** The guest's own "I've paid" changed (or failed): read the bill again. */
  onChanged: () => void;
  onClose: () => void;
}

/**
 * The guest's own bill: who to pay, the Swish number, their share of each
 * purchase and the total. Opened only by the guest tapping the receipt icon.
 */
export function BillSheet({
  bill,
  eventId,
  code,
  guestName,
  updated,
  onChanged,
  onClose,
}: BillSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [swishFailed, setSwishFailed] = useState(false);
  const stopWatching = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopWatching.current?.(), []);

  /** The Swish link was tapped: if the app doesn't open, say so and log it. */
  function watchSwish() {
    stopWatching.current?.();
    setSwishFailed(false);
    stopWatching.current = watchSwishOpen(() => {
      setSwishFailed(true);
      void logError({
        area: "costs",
        action: "open_swish",
        code: "app_not_opened",
      });
    });
  }

  async function say(paid: boolean) {
    setBusy(true);
    setError(undefined);
    const result = await setIPaid(eventId, paid);
    setBusy(false);
    if (!result.ok) {
      setError(t(`guest.bill.errors.${result.error}`));
      void logError({ area: "costs", action: "i_paid", code: result.error });
    }
    // Also after a refusal: the host may have changed the bill meanwhile.
    onChanged();
  }

  const pay = {
    number: bill.swishNumber,
    amount: bill.owed,
    message: swishMessage(code, guestName),
  };

  return (
    <SheetFrame labelledBy="bill-title" onClose={onClose}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="bill-title"
            className="font-display text-2xl font-bold break-words"
          >
            {t("guest.bill.title", { name: bill.payeeName })}
          </h2>
          {updated && (
            <p className="text-sm font-bold text-on-paper-muted">
              {t("guest.bill.updated")}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("guest.bill.close")}
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </header>
      <p className="text-base">
        {t("guest.bill.swish", { number: nationalNumber(bill.swishNumber) })}
      </p>
      {bill.lines.length === 0 ? (
        <p className="text-on-paper-muted">{t("guest.bill.nothing")}</p>
      ) : (
        <ul className="space-y-2">
          {bill.lines.map((line, index) => (
            <li
              key={`${index}-${line.name}`}
              className="flex justify-between gap-3"
            >
              <span className="min-w-0 break-words">{line.name}</span>
              <span className="shrink-0">{formatKr(line.share)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="flex justify-between gap-3 border-t-[length:var(--border-thin)] border-edge pt-3 font-display text-xl font-bold">
        <span>{t("guest.bill.total")}</span>
        <span>{formatKr(bill.total)}</span>
      </p>
      {bill.confirmed > 0 && (
        <div className="space-y-1">
          <p className="flex justify-between gap-3">
            <span>{t("guest.bill.paidSoFar")}</span>
            <span>{formatKr(bill.confirmed)}</span>
          </p>
          {bill.owed > 0 && (
            <p className="flex justify-between gap-3 font-bold">
              <span>{t("guest.bill.leftToPay")}</span>
              <span>{formatKr(bill.owed)}</span>
            </p>
          )}
        </div>
      )}
      {bill.status === "paid" && bill.total > 0 && (
        <p data-testid="bill-paid" className="font-display text-xl font-bold">
          {t("guest.bill.paidThanks")}
        </p>
      )}
      {bill.status === "says_paid" && (
        <div className="space-y-3" data-testid="bill-says-paid">
          <p className="text-base">
            {t("guest.bill.saysPaid", { name: bill.payeeName })}
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void say(false)}
          >
            {t("guest.bill.undoPaid")}
          </Button>
        </div>
      )}
      {bill.status === "owes" && bill.owed > 0 && (
        <div className="space-y-3">
          <Button asChild className="w-full">
            <a
              href={swishAppLink(pay)}
              data-testid="swish-button"
              onClick={watchSwish}
            >
              {t("guest.bill.payWithSwish")}
            </a>
          </Button>
          {swishFailed && (
            <ErrorLine>{t("guest.bill.swishNotOpened")}</ErrorLine>
          )}
          <div className="flex flex-col items-center gap-2">
            <CatchBoundary
              onError={() =>
                void logError({
                  area: "costs",
                  action: "render_qr",
                  code: "render_failed",
                })
              }
              fallback={(retry) => (
                <div className="space-y-2" data-testid="qr-failed">
                  <ErrorLine>{t("guest.bill.qrFailed")}</ErrorLine>
                  <Button size="sm" variant="outline" onClick={retry}>
                    {t("guest.bill.retry")}
                  </Button>
                </div>
              )}
            >
              <QrCode
                value={swishQrText(pay)}
                label={t("guest.bill.qrLabel")}
                size={176}
              />
              <p className="text-center text-sm text-on-paper-muted">
                {t("guest.bill.qrHint")}
              </p>
            </CatchBoundary>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            data-testid="i-paid"
            onClick={() => void say(true)}
          >
            {t("guest.bill.iPaid")}
          </Button>
        </div>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </SheetFrame>
  );
}
