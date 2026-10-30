import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  storeLanguage,
  supportedLanguages,
  type Language,
} from "@/i18n/language";

/** Lets anyone switch the UI between Swedish and English on this device: a quiet "SV / EN". */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  function select(language: Language) {
    storeLanguage(language);
    // Resources are bundled, so switching cannot fail on a network request.
    void i18n.changeLanguage(language);
  }

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="flex items-center font-display text-base text-ink-muted"
    >
      {supportedLanguages.map((language, index) => {
        const isActive = i18n.resolvedLanguage === language;
        return (
          <Fragment key={language}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              aria-pressed={isActive}
              aria-label={t(`language.${language}`)}
              lang={language}
              onClick={() => select(language)}
              className="min-h-12 min-w-12 rounded-sm px-2 font-semibold hover:text-ink aria-pressed:font-extrabold aria-pressed:text-ink"
            >
              {t(`language.${language}Short`)}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
