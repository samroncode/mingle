import { awAwards } from "./awards/aw";
import { awHotTakes } from "./hottakes/aw";
import { awQuiz } from "./quiz/aw";
import type { NicheConfig } from "./types";

export const aw: NicheConfig = {
  id: "aw",
  nameKey: "niches.aw.name",
  descriptionKey: "niches.aw.description",
  theme: { id: "garden", overrides: {} },
  defaultModules: ["quiz", "awards", "hottakes"],
  defaultSharedCosts: false,
  welcome: {
    sv: "Välkomna! Ta en dryck, slå er ner och njut av kvällen. Vi har lekar och omröstningar på gång, så håll telefonen nära till hands.",
    en: "Welcome! Grab a drink, settle in and enjoy the evening. We have games and votes coming up, so keep your phone handy.",
  },
  quiz: awQuiz,
  awards: awAwards,
  hottakes: awHotTakes,
  promptHints:
    "Relaxed after-work with colleagues. Keep it light and inclusive, and avoid anything that could embarrass someone in front of their manager.",
};
