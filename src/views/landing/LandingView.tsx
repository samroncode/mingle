import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { JoinWithCode } from "@/components/JoinWithCode";
import { MyEvents } from "@/components/MyEvents";
import { Button } from "@/components/ui/button";

export function LandingView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t("app.name")}</h1>
      <p className="text-muted-foreground">{t("views.landing.intro")}</p>
      <Button asChild size="lg">
        <Link to="/new">{t("views.landing.create")}</Link>
      </Button>
      <JoinWithCode />
      <MyEvents />
    </div>
  );
}
