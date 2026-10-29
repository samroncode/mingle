import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/QrCode";
import { guestAddress } from "@/lib/links";

interface JoinPanelProps {
  code: string;
  guestCount: number;
}

/** The fixed right-hand panel of the party screen: how guests join. */
export function JoinPanel({ code, guestCount }: JoinPanelProps) {
  const { t } = useTranslation();
  const address = guestAddress(window.location.origin, code);
  return (
    <aside
      aria-label={t("tv.join.title")}
      className="tv-float flex flex-col items-center gap-5 self-center rounded-xl border-[length:var(--border-chunky)] border-edge bg-champagne p-(--space-6) text-center text-on-bright shadow-pop-lg"
    >
      <h2 className="font-display text-4xl font-extrabold">
        {t("tv.join.title")}
      </h2>
      <QrCode value={address} label={t("tv.join.qrLabel")} size={320} />
      <p
        data-testid="tv-code"
        className="font-display text-7xl font-extrabold tracking-widest"
      >
        {code}
      </p>
      <p data-testid="join-address" className="font-body text-2xl break-all">
        {address}
      </p>
      <p data-testid="guest-count" className="font-display text-3xl font-bold">
        {t("tv.join.guests", { count: guestCount })}
      </p>
    </aside>
  );
}
