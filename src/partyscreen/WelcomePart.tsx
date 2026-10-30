import { useTranslation } from "react-i18next";

interface WelcomePartProps {
  welcome: string | undefined;
}

/** The welcome text, set straight on the TV ground beside the join column. */
export function WelcomePart({ welcome }: WelcomePartProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("tv.welcome")}
      className="flex h-full items-center px-(--space-7) text-ink"
    >
      <p
        data-testid="welcome-text"
        className="tv-float max-w-[14ch] font-display text-9xl leading-[0.95] font-extrabold text-balance"
      >
        {welcome ?? t("app.name")}
      </p>
    </section>
  );
}
