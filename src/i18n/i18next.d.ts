import "i18next";
import type en from "./en.json";

// Types every translation key from en.json, so an unknown key fails typecheck.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}
