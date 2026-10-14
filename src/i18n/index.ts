import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import {
  defaultLanguage,
  loadStoredLanguage,
  resolveLanguage,
  supportedLanguages,
} from "./language";
import sv from "./sv.json";

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

await i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sv: { translation: sv },
  },
  lng: resolveLanguage({
    stored: loadStoredLanguage(),
    browserLanguages: navigator.languages,
  }),
  fallbackLng: defaultLanguage,
  supportedLngs: supportedLanguages,
  // React already escapes rendered values.
  interpolation: { escapeValue: false },
});
