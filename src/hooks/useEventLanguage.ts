import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { loadStoredLanguage, resolveLanguage } from "@/i18n/language";

/**
 * Starts the views in the event's language, unless this device has a stored
 * choice. The language switcher still wins afterwards.
 */
export function useEventLanguage(eventLanguage: string | undefined) {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!eventLanguage) return;
    const language = resolveLanguage({
      stored: loadStoredLanguage(),
      eventLanguage,
      browserLanguages: navigator.languages,
    });
    void i18n.changeLanguage(language);
    // i18n is a stable singleton; run only when the event's language arrives.
  }, [eventLanguage, i18n]);
}
