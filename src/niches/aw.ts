import type { NicheConfig } from "./types";

export const aw: NicheConfig = {
  id: "aw",
  nameKey: "niches.aw.name",
  descriptionKey: "niches.aw.description",
  // Placeholder values until the visual design exists.
  theme: {
    primary: "oklch(0.6 0.16 45)",
    "primary-foreground": "oklch(0.985 0 0)",
    radius: "0.75rem",
  },
  defaultModules: ["quiz", "awards", "hottakes"],
  welcome: {
    sv: "Välkomna! Ta en dryck, slå er ner och njut av kvällen. Vi har lekar och omröstningar på gång, så håll telefonen nära till hands.",
    en: "Welcome! Grab a drink, settle in and enjoy the evening. We have games and votes coming up, so keep your phone handy.",
  },
  promptHints:
    "Relaxed after-work with colleagues. Keep it light and inclusive, and avoid anything that could embarrass someone in front of their manager.",
};
