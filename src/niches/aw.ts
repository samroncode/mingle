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
  promptHints:
    "Relaxed after-work with colleagues. Keep it light and inclusive, and avoid anything that could embarrass someone in front of their manager.",
};
