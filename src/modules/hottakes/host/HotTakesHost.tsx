import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleHostProps } from "../../types";
import { useHotTakes } from "../useHotTakes";

/** The hot takes' section in the control panel: the hot takes in order. */
export function HotTakesHost({ event }: ModuleHostProps) {
  const { t } = useTranslation();
  const state = useHotTakes(event.id);

  return (
    <section
      data-testid="hottakes-host"
      aria-labelledby="hottakes-host-title"
      className="space-y-2"
    >
      <h2 id="hottakes-host-title" className="text-lg font-semibold">
        {t("modules.hottakes.name")}
      </h2>
      {state.status === "error" && (
        <ErrorLine>{t("modules.hottakes.host.loadFailed")}</ErrorLine>
      )}
      {state.status === "ready" && state.takes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("modules.hottakes.host.empty")}
        </p>
      )}
      {state.status === "ready" && state.takes.length > 0 && (
        <ol className="space-y-2">
          {state.takes.map((take) => (
            <li key={take.id}>
              <Card className="p-3">
                <p className="font-medium">
                  {take.position + 1}. {take.text}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
