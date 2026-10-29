import { useTranslation } from "react-i18next";

interface WelcomePartProps {
  welcome: string | undefined;
}

/** The welcome text; for now it is the whole left side of the party screen. */
export function WelcomePart({ welcome }: WelcomePartProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("tv.welcome")}
      className="flex h-full items-center justify-center rounded-xl border-[length:var(--border-chunky)] border-edge bg-forest p-(--space-7) text-on-forest shadow-pop-lg"
    >
      <p
        data-testid="welcome-text"
        className="text-center font-display text-7xl leading-tight font-extrabold"
      >
        {welcome ?? t("app.name")}
      </p>
    </section>
  );
}
