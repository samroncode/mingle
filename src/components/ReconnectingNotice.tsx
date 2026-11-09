import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** A small, calm note that the screen may be out of date while we reconnect. */
export function ReconnectingNotice({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      role="status"
      data-testid="reconnecting"
      className={cn(
        "w-fit rounded-full border-[length:var(--border-thin)] border-edge bg-champagne px-3 py-1 text-sm font-bold text-on-bright",
        className,
      )}
    >
      {t("connection.reconnecting")}
    </p>
  );
}
