import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { EventLinks } from "@/components/EventLinks";
import { Button } from "@/components/ui/button";
import { hostPath } from "@/lib/links";

interface DoneScreenProps {
  code: string;
  hostKey: string;
}

/**
 * Shown right after Create. The server keeps only a hash of the key, so this
 * screen shows the host link without a tap for the host to save it; the
 * control panel hides it until asked.
 */
export function DoneScreen({ code, hostKey }: DoneScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("wizard.done.title")}</h1>
      <EventLinks code={code} hostKey={hostKey} />
      <p
        role="alert"
        className="rounded-lg border border-destructive p-3 text-sm text-destructive"
      >
        {t("wizard.done.warning")}
      </p>
      <Button asChild size="lg" className="w-full">
        <Link to={hostPath(code, hostKey)}>{t("wizard.done.openPanel")}</Link>
      </Button>
    </div>
  );
}
