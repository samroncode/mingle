import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { SheetFrame } from "./SheetFrame";

interface BillLoadErrorProps {
  onRetry: () => void;
  onClose: () => void;
}

/** Shown when the guest's bill couldn't be read: say so, and let them retry. */
export function BillLoadError({ onRetry, onClose }: BillLoadErrorProps) {
  const { t } = useTranslation();
  return (
    <SheetFrame labelledBy="bill-error-title" onClose={onClose}>
      <header className="flex items-start justify-between gap-3">
        <h2 id="bill-error-title" className="font-display text-2xl font-bold">
          {t("guest.bill.loadFailedTitle")}
        </h2>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("guest.bill.close")}
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </header>
      <ErrorLine>{t("guest.bill.loadFailed")}</ErrorLine>
      <Button className="w-full" data-testid="bill-retry" onClick={onRetry}>
        {t("guest.bill.retry")}
      </Button>
    </SheetFrame>
  );
}
