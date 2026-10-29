import { useTranslation } from "react-i18next";
import { removeGuest } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import type { ListedGuest } from "@/lib/host/guest-list";

interface RemoveGuestProps {
  guest: ListedGuest;
  code: string;
  hostKey: string;
  onDone: () => void;
}

/** The confirm before a guest is removed. Cancel sends nothing. */
export function RemoveGuest({
  guest,
  code,
  hostKey,
  onDone,
}: RemoveGuestProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();

  async function remove() {
    const result = await run(() =>
      removeGuest({ code, key: hostKey, userId: guest.userId }),
    );
    if (result.ok) onDone();
  }

  return (
    <div
      role="alertdialog"
      aria-label={t("hostPanel.guestList.removeTitle", { name: guest.name })}
      className="space-y-3 rounded-md border-[length:var(--border-thin)] border-danger bg-surface-sunken p-3 text-ink"
    >
      <p className="text-base">
        {t("hostPanel.guestList.removeConfirm", { name: guest.name })}
      </p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void remove()}
        >
          {t("hostPanel.guestList.removeAction")}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onDone}>
          {t("hostPanel.guestList.cancel")}
        </Button>
      </div>
    </div>
  );
}
