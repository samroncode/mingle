import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleHostProps } from "../../types";
import { useAwardCategories } from "../useAwardCategories";

/** The awards' section in the control panel: the categories in order. */
export function AwardsHost({ event }: ModuleHostProps) {
  const { t } = useTranslation();
  const state = useAwardCategories(event.id);

  return (
    <section
      data-testid="awards-host"
      aria-labelledby="awards-host-title"
      className="space-y-2"
    >
      <h2 id="awards-host-title" className="text-lg font-semibold">
        {t("modules.awards.name")}
      </h2>
      {state.status === "error" && (
        <ErrorLine>{t("modules.awards.host.loadFailed")}</ErrorLine>
      )}
      {state.status === "ready" && state.categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("modules.awards.host.empty")}
        </p>
      )}
      {state.status === "ready" && state.categories.length > 0 && (
        <ol className="space-y-2">
          {state.categories.map((category) => (
            <li key={category.id}>
              <Card className="p-3">
                <p className="font-medium">
                  {category.position + 1}. {category.text}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
