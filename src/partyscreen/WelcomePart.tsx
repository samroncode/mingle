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
      className="flex h-full items-center justify-center"
    >
      <p
        data-testid="welcome-text"
        className="text-center text-6xl leading-tight font-semibold"
      >
        {welcome ?? t("app.name")}
      </p>
    </section>
  );
}
