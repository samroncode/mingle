import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { welcomeSize } from "./welcome-size";

interface WelcomePartProps {
  welcome: string | undefined;
}

/** The welcome text, set straight on the TV ground; shorter text is bigger. */
export function WelcomePart({ welcome }: WelcomePartProps) {
  const { t } = useTranslation();
  const text = welcome ?? t("app.name");
  return (
    <section aria-label={t("tv.welcome")} className="text-ink">
      <p
        data-testid="welcome-text"
        className={cn(
          "tv-float font-display font-extrabold text-balance",
          welcomeSize(text),
        )}
      >
        {text}
      </p>
    </section>
  );
}
