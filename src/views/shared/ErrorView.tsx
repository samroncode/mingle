import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";
import { logCaught } from "@/api/log";
import { Button } from "@/components/ui/button";
import { reportRenderCrash } from "@/lib/logging/catchAll";

/**
 * Shown by the router when a view throws. It replaces the layout, so it brings
 * its own page shell. It logs the crash once and shows its message even if
 * logging fails.
 */
export function ErrorView() {
  const { t } = useTranslation();
  const error = useRouteError();
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    reportRenderCrash(error, (entry) => void logCaught(entry));
  }, [error]);
  return (
    <main
      data-layout="error"
      className="mx-auto min-h-svh max-w-md space-y-4 p-4"
    >
      <h1 className="text-2xl font-semibold">{t("views.error.title")}</h1>
      <Button onClick={() => window.location.reload()}>
        {t("views.error.reload")}
      </Button>
    </main>
  );
}
