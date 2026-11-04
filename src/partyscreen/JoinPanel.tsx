import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/QrCode";
import { guestAddress } from "@/lib/links";

interface JoinPanelProps {
  code: string;
  guestCount: number;
}

/** The join card on the right of the party screen: how guests get in. */
export function JoinPanel({ code, guestCount }: JoinPanelProps) {
  const { t } = useTranslation();
  const address = guestAddress(window.location.origin, code);
  return (
    <aside
      aria-label={t("tv.join.title")}
      className="flex flex-col items-center gap-(--space-4) self-start rounded-xl border-[length:var(--border-thin)] border-edge bg-forest p-(--space-6) text-center text-on-forest"
    >
      <h2 className="font-display text-4xl font-extrabold">
        {t("tv.join.title")}
      </h2>
      <QrCode value={address} label={t("tv.join.qrLabel")} size={280} />
      <p
        data-testid="tv-code"
        className="font-display text-7xl leading-none font-extrabold tracking-widest text-champagne"
      >
        {code}
      </p>
      <p
        data-testid="join-address"
        className="font-body text-xl break-all text-on-forest"
      >
        {address}
      </p>
      <p data-testid="guest-count" className="font-display text-2xl font-bold">
        {t("tv.join.guests", { count: guestCount })}
      </p>
    </aside>
  );
}
