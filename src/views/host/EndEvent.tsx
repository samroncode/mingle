import { ErrorLine } from "@/components/ErrorLine";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setFlow } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";

interface EndEventProps {
  code: string;
  hostKey: string;
  onEnded: () => void;
}

/** End the evening, behind a confirm. Cancel sends nothing. */
export function EndEvent({ code, hostKey, onEnded }: EndEventProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useHostAction();

  async function end() {
    const result = await run(() =>
      setFlow({ code, key: hostKey, move: { type: "end_event" } }),
    );
    if (result.ok) onEnded();
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div
          role="alertdialog"
          aria-label={t("hostPanel.end.title")}
          className="space-y-3 rounded-md border-[length:var(--border-thin)] border-danger bg-surface-sunken p-3 text-ink"
        >
          <p className="text-base">{t("hostPanel.end.confirm")}</p>
          <div className="flex flex-col gap-3">
            <Button
              variant="destructive"
              size="lg"
              disabled={busy}
              onClick={() => void end()}
            >
              {t("hostPanel.end.action")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {t("hostPanel.end.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="destructive"
          size="lg"
          onClick={() => setConfirming(true)}
        >
          {t("hostPanel.end.title")}
        </Button>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}
