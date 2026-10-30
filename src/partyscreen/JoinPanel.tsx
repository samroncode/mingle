import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/QrCode";
import { guestAddress } from "@/lib/links";

interface JoinPanelProps {
  code: string;
  guestCount: number;
}

/** The fixed right-hand column of the party screen: how guests join. */
export function JoinPanel({ code, guestCount }: JoinPanelProps) {
  const { t } = useTranslation();
  const address = guestAddress(window.location.origin, code);
  return (
    <aside
      aria-label={t("tv.join.title")}
      className="flex flex-col justify-center gap-5 border-l-[length:var(--border-thin)] border-line pl-(--space-7) text-ink"
    >
      <h2 className="font-display text-4xl font-extrabold">
        {t("tv.join.title")}
      </h2>
      <QrCode value={address} label={t("tv.join.qrLabel")} size={320} />
      <p
        data-testid="tv-code"
        className="font-display text-8xl leading-none font-extrabold tracking-widest text-champagne-text"
      >
        {code}
      </p>
      <p
        data-testid="join-address"
        className="font-body text-2xl break-all text-ink-muted"
      >
        {address}
      </p>
      <p data-testid="guest-count" className="font-display text-3xl font-bold">
        {t("tv.join.guests", { count: guestCount })}
      </p>
    </aside>
  );
}
