import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundView() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("views.notFound.title")}</h1>
      <Button asChild variant="link" className="px-0">
        <Link to="/">{t("views.notFound.home")}</Link>
      </Button>
    </>
  );
}
