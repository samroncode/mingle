import { useTranslation } from "react-i18next";

/** Suspense fallback while a route's code loads. */
export function RouteLoading() {
  const { t } = useTranslation();
  return (
    <p role="status" className="p-4 text-center text-muted-foreground">
      {t("views.loading")}
    </p>
  );
}
