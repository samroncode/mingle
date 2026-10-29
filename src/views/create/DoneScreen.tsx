import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { EventLinks } from "@/components/EventLinks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <h1 className="font-display text-3xl leading-tight font-extrabold">
        {t("wizard.done.title")}
      </h1>
      <Card>
        <EventLinks code={code} hostKey={hostKey} />
      </Card>
      <p
        role="alert"
        className="flex items-start gap-3 rounded-md border-[length:var(--border-thin)] border-danger bg-surface-sunken p-3 text-base"
      >
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-danger-text"
        />
        <span>{t("wizard.done.warning")}</span>
      </p>
      <Button asChild size="lg" className="w-full">
        <Link to={hostPath(code, hostKey)}>{t("wizard.done.openPanel")}</Link>
      </Button>
    </div>
  );
}
