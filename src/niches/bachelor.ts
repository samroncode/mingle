import { bachelorAwards } from "./awards/bachelor";
import { bachelorHotTakes } from "./hottakes/bachelor";
import { bachelorQuiz } from "./quiz/bachelor";
import type { NicheConfig } from "./types";

export const bachelor: NicheConfig = {
  id: "bachelor",
  nameKey: "niches.bachelor.name",
  descriptionKey: "niches.bachelor.description",
  // Blush leads instead of coral.
  theme: {
    id: "garden",
    overrides: {
      primary: "var(--blush)",
      "primary-foreground": "var(--on-bright)",
      "sidebar-primary": "var(--blush)",
      "sidebar-primary-foreground": "var(--on-bright)",
    },
  },
  defaultModules: ["quiz", "awards", "hottakes"],
  defaultSharedCosts: false,
  welcome: {
    sv: "Välkomna till kvällen! Nu ska vi fira ordentligt. Skanna koden, skriv ditt namn och gör er redo för skratt och bus.",
    en: "Welcome to the party! Time to celebrate properly. Scan the code, enter your name and get ready for laughs and mischief.",
  },
  quiz: bachelorQuiz,
  awards: bachelorAwards,
  hottakes: bachelorHotTakes,
  promptHints:
    "Bachelor or bachelorette party with close friends. Playful and teasing but affectionate, never cruel, and nothing that could truly embarrass the guest of honour.",
};
