import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setFlow } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { hostPanelErrorKey } from "@/lib/host-panel";

interface EndEventProps {
  code: string;
  hostKey: string;
  onEnded: () => void;
}

/** End the evening, behind a confirm. Cancel sends nothing. */
export function EndEvent({ code, hostKey, onEnded }: EndEventProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function end() {
    setBusy(true);
    setError(undefined);
    const result = await setFlow({
      code,
      key: hostKey,
      move: { type: "end_event" },
    });
    setBusy(false);
    if (result.ok) return onEnded();
    setError(t(hostPanelErrorKey(result.error)));
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div
          role="alertdialog"
          aria-label={t("hostPanel.end.title")}
          className="space-y-2 rounded-lg border p-3"
        >
          <p className="text-sm">{t("hostPanel.end.confirm")}</p>
          <div className="flex gap-2">
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
