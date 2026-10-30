/** The fill of a choice tile: one of the four bright colours, or plain paper. */
export type ChoiceFill = "coral" | "champagne" | "blush" | "sage" | "paper";

/** Whether this tile is the guest's answer, another one is, or none is yet. */
export type ChoiceState = "idle" | "chosen" | "other-chosen";

/** The state of one tile, given whether it is the answer and whether any answer is chosen. */
export function choiceState(
  isChosen: boolean,
  anyChosen: boolean,
): ChoiceState {
  if (isChosen) return "chosen";
  return anyChosen ? "other-chosen" : "idle";
}
