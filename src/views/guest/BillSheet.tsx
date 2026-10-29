import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { nationalNumber } from "@/lib/costs/costs-form";
import { formatKr } from "@/lib/costs/shares";
import type { MyBill } from "@/lib/schemas/bill";

interface BillSheetProps {
  bill: MyBill;
  updated: boolean;
  onClose: () => void;
}

/**
 * The guest's own bill: who to pay, the Swish number, their share of each
 * purchase and the total. Opened only by the guest tapping the receipt icon.
 */
export function BillSheet({ bill, updated, onClose }: BillSheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-surface-sunken/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-title"
        data-testid="bill-sheet"
        className="max-h-[85svh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg border-[length:var(--border-chunky)] border-edge bg-paper p-5 text-on-paper shadow-pop-lg"
        onClick={(event) => event.stopPropagation()}
      >
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
      </section>
    </div>,
    document.body,
  );
}
