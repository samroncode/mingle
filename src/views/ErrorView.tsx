import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * Shown by the router when a view throws. It replaces the layout, so it brings
 * its own page shell.
 */
export function ErrorView() {
  const { t } = useTranslation();
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
