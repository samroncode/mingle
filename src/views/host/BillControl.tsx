import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setBillSent } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";

interface BillControlProps {
  code: string;
  hostKey: string;
  /** The bill has been sent and guests can see their share. */
  sent: boolean;
  onDone: () => void;
}

/**
 * Sends the bill to the guests, after a confirm, or hides it again. Until it
 * is sent, guests see nothing about money.
 */
export function BillControl({ code, hostKey, sent, onDone }: BillControlProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useHostAction();

  async function change(next: boolean) {
    const result = await run(() =>
      setBillSent({ code, key: hostKey, sent: next }),
    );
    if (result.ok) {
      setConfirming(false);
      onDone();
    }
  }

  if (sent) {
    return (
      <div className="space-y-2" data-testid="bill-control">
        <p className="font-display font-bold">
          {t("hostPanel.costs.billSent")}
        </p>
        <p className="text-sm text-on-paper-muted">
          {t("hostPanel.costs.billSentHint")}
        </p>
        {error && <ErrorLine>{error}</ErrorLine>}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void change(false)}
        >
          {t("hostPanel.costs.hideBill")}
        </Button>
      </div>
    );
  }
  if (!confirming) {
    return (
      <div className="space-y-2" data-testid="bill-control">
        <p className="text-sm text-on-paper-muted">
          {t("hostPanel.costs.billNotSentHint")}
        </p>
        <Button size="sm" onClick={() => setConfirming(true)}>
          {t("hostPanel.costs.sendBill")}
        </Button>
      </div>
    );
  }
  return (
    <div
      role="alertdialog"
      aria-label={t("hostPanel.costs.sendBill")}
      data-testid="bill-control"
      className="space-y-3 rounded-md border-[length:var(--border-thin)] border-edge p-3"
    >
      <p className="text-base">{t("hostPanel.costs.sendBillConfirm")}</p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void change(true)}>
          {t("hostPanel.costs.sendBillAction")}
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
