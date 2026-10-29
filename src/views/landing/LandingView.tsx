import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { JoinWithCode } from "@/components/JoinWithCode";
import { Logo } from "@/components/Logo";
import { MyEvents } from "@/components/MyEvents";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LandingView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header className="space-y-3 pt-4">
        <h1>
          <Logo className="text-7xl" />
        </h1>
        <p className="font-display text-2xl leading-tight font-bold text-ink">
          {t("views.landing.intro")}
        </p>
      </header>
      <Card className="gap-4 bg-champagne p-5 text-on-bright">
        <JoinWithCode />
      </Card>
      <Button asChild size="lg" variant="secondary">
        <Link to="/new">{t("views.landing.create")}</Link>
      </Button>
      <MyEvents />
    </div>
  );
}
