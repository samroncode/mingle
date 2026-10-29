import { teamAwards } from "./awards/team";
import { teamHotTakes } from "./hottakes/team";
import { teamQuiz } from "./quiz/team";
import type { NicheConfig } from "./types";

export const team: NicheConfig = {
  id: "team",
  nameKey: "niches.team.name",
  descriptionKey: "niches.team.description",
  theme: { id: "loud", overrides: {} },
  defaultModules: ["quiz", "hottakes"],
  welcome: {
    sv: "Välkomna, och tack för att ni är här! Ikväll ska vi ha det trevligt tillsammans. Slå er ner, ta fram telefonen och häng med.",
    en: "Welcome, and thanks for being here! Tonight is about having fun together. Grab a seat, get your phone ready and join in.",
  },
  quiz: teamQuiz,
  awards: teamAwards,
  hottakes: teamHotTakes,
  promptHints:
    "Team event with colleagues from the same workplace. Keep it friendly and inclusive, work-appropriate, and never put an individual on the spot.",
};
