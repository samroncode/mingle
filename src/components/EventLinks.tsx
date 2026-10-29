import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { hostLink, tvAddress } from "@/lib/links";

interface EventLinksProps {
  code: string;
  hostKey: string;
  /**
   * Keeps the host link off screen until the host taps to show it, so a
   * mirrored or shared phone screen doesn't expose it. Copy and Share work
   * either way.
   */
  hideHostLink?: boolean;
}

/**
 * The event code in big letters, the host link with Copy (and Share where the
 * browser has it) and the TV address. Used by the create flow's last screen
 * and by the control panel.
 */
export function EventLinks({
  code,
  hostKey,
  hideHostLink = false,
}: EventLinksProps) {
  const { t } = useTranslation();
  const [hostShown, setHostShown] = useState(!hideHostLink);
  const host = hostLink(window.location.origin, code, hostKey);
  const tv = tvAddress(window.location.origin, code);
  const canShare = typeof navigator.share === "function";

  async function share() {
    try {
      await navigator.share({ title: t("app.name"), url: host });
    } catch {
      // The host closed the share menu.
    }
  }

  return (
    <div className="space-y-4">
      <section aria-label={t("links.codeLabel")}>
        <p className="text-sm text-on-paper-muted">{t("links.codeLabel")}</p>
        <p
          data-testid="event-code"
          className="font-display text-5xl font-extrabold tracking-widest"
        >
          {code}
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">
          {t("links.hostLabel")}
        </h2>
        {hostShown ? (
          <p
            data-testid="host-link"
            className="rounded-md bg-surface-sunken p-3 text-sm break-all text-ink"
          >
            {host}
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHostShown(true)}
          >
            {t("links.showHost")}
          </Button>
        )}
        <div className="flex gap-2">
          <CopyButton text={host} label={t("links.copyHost")} />
          {canShare && (
            <Button variant="outline" onClick={() => void share()}>
              {t("common.share")}
            </Button>
          )}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">{t("links.tvLabel")}</h2>
        <p
          data-testid="tv-address"
          className="rounded-md bg-surface-sunken p-3 text-sm break-all text-ink"
        >
          {tv}
        </p>
        <CopyButton text={tv} label={t("links.copyTv")} />
      </section>
    </div>
  );
}
