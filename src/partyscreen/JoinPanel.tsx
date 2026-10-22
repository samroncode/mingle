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
      className="flex flex-col items-center gap-4 rounded-xl bg-card p-8 text-center text-card-foreground"
    >
      <h2 className="text-3xl font-semibold">{t("tv.join.title")}</h2>
      <QrCode value={address} label={t("tv.join.qrLabel")} size={320} />
      <p
        data-testid="tv-code"
        className="font-mono text-7xl font-bold tracking-widest"
      >
        {code}
      </p>
      <p data-testid="join-address" className="text-xl break-all">
        {address}
      </p>
      <p data-testid="guest-count" className="text-3xl font-medium">
        {t("tv.join.guests", { count: guestCount })}
      </p>
    </aside>
  );
}
