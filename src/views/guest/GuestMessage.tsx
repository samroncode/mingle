import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

type Kind = "ended" | "not_found" | "error" | "note";

/** A full-page message: thank-you, wrong code, connection error or role note. */
export function GuestMessage({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t(`guest.${kind}.title`)}</h1>
      <p className="text-muted-foreground">{t(`guest.${kind}.body`)}</p>
      {(kind === "not_found" || kind === "error") && (
        <Button asChild variant="link" className="px-0">
          <Link to="/">{t("views.notFound.home")}</Link>
        </Button>
      )}
    </div>
  );
}
