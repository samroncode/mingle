import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  storeLanguage,
  supportedLanguages,
  type Language,
} from "@/i18n/language";

/** Lets anyone switch the UI between Swedish and English on this device. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  function select(language: Language) {
    storeLanguage(language);
    // Resources are bundled, so switching cannot fail on a network request.
    void i18n.changeLanguage(language);
  }

  return (
    <div role="group" aria-label={t("language.label")} className="flex gap-1">
      {supportedLanguages.map((language) => {
        const isActive = i18n.resolvedLanguage === language;
        return (
          <Button
            key={language}
            size="sm"
            variant={isActive ? "secondary" : "ghost"}
            aria-pressed={isActive}
            lang={language}
            onClick={() => select(language)}
          >
            {t(`language.${language}`)}
          </Button>
        );
      })}
    </div>
  );
}
