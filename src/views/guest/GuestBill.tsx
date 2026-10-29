import { Receipt } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useMyBill } from "@/hooks/useMyBill";
import { BillSheet } from "./BillSheet";

interface GuestBillProps {
  eventId: string;
  /** The event code and the guest's display name, for the Swish message. */
  code: string;
  guestName: string;
  /** Changes whenever the bill may have changed; see useMyBill. */
  signal: number;
  /** Where the icon goes, next to the language switch. */
  slot: HTMLElement | null | undefined;
}

/**
 * A small receipt icon, only while the host has sent the bill, with a dot
 * while the guest owes something. It never opens by itself and shows no
 * popup, sound or banner.
 */
export function GuestBill({
  eventId,
  code,
  guestName,
  signal,
  slot,
}: GuestBillProps) {
  const { t } = useTranslation();
  // Open, and whether the total had changed since the guest last looked.
  const [open, setOpen] = useState<"plain" | "updated">();
  const { bill, updated, markSeen } = useMyBill(eventId, signal);
  if (!bill || !slot) return null;

  const owes = bill.total > 0;
  const label = updated ? t("guest.bill.openUpdated") : t("guest.bill.open");
  return (
    <>
      {createPortal(
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          data-testid="bill-icon"
          data-owes={owes}
          className="relative"
          onClick={() => {
            markSeen();
            setOpen(updated ? "updated" : "plain");
          }}
        >
          <Receipt aria-hidden />
          {(owes || updated) && (
            <span
              aria-hidden
              data-testid="bill-dot"
              className="absolute top-2 right-2 size-2.5 rounded-pill border-[length:var(--border-thin)] border-edge bg-coral"
            />
          )}
        </Button>,
        slot,
      )}
      {open && (
        <BillSheet
          bill={bill}
          code={code}
          guestName={guestName}
          updated={open === "updated"}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  );
}
