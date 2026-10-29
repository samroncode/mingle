import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Kind =
  "ended" | "not_found" | "removed" | "error" | "note" | "captcha_failed";

/** A full-page message: thank-you, wrong code, connection error or role note. */
export function GuestMessage({
  kind,
  onRetry,
}: {
  kind: Kind;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-4 p-6">
      <h1 className="font-display text-4xl leading-tight font-extrabold">
        {t(`guest.${kind}.title`)}
      </h1>
      <p className="text-lg text-on-paper-muted">{t(`guest.${kind}.body`)}</p>
      {kind === "captcha_failed" && onRetry && (
        <Button onClick={onRetry}>{t("captcha.retry")}</Button>
      )}
      {(kind === "not_found" || kind === "error") && (
        <Button asChild variant="secondary">
          <Link to="/">{t("views.notFound.home")}</Link>
        </Button>
      )}
    </Card>
  );
}
