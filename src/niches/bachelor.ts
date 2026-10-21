import type { NicheConfig } from "./types";

export const bachelor: NicheConfig = {
  id: "bachelor",
  nameKey: "niches.bachelor.name",
  descriptionKey: "niches.bachelor.description",
  // Placeholder values until the visual design exists.
  theme: {
    primary: "oklch(0.62 0.2 340)",
    "primary-foreground": "oklch(0.985 0 0)",
    radius: "1rem",
  },
  defaultModules: ["quiz", "awards", "hottakes"],
  welcome: {
    sv: "Välkomna till kvällen! Nu ska vi fira ordentligt. Skanna koden, skriv ditt namn och gör er redo för skratt och bus.",
    en: "Welcome to the party! Time to celebrate properly. Scan the code, enter your name and get ready for laughs and mischief.",
  },
  promptHints:
    "Bachelor or bachelorette party with close friends. Playful and teasing but affectionate, never cruel, and nothing that could truly embarrass the guest of honour.",
};
