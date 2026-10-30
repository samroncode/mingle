import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { JoinWithCode } from "@/components/JoinWithCode";
import { Logo } from "@/components/Logo";
import { MyEvents } from "@/components/MyEvents";
import { Button } from "@/components/ui/button";

export function LandingView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <header className="space-y-3 pt-4">
        <h1>
          <Logo className="text-7xl" />
        </h1>
        <p className="max-w-prose text-lg text-ink-muted">
          {t("views.landing.intro")}
        </p>
      </header>
      <JoinWithCode />
      <Button asChild size="lg" variant="secondary">
        <Link to="/new">{t("views.landing.create")}</Link>
      </Button>
      <MyEvents />
    </div>
  );
}
