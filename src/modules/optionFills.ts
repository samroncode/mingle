/** The fill of option A to D: coral, champagne, blush, sage. */
export const optionFills = [
  "bg-coral",
  "bg-champagne",
  "bg-blush",
  "bg-sage",
] as const;

/** The same four colours as choice tile fills, for guest answer tiles. */
export const optionTones = ["coral", "champagne", "blush", "sage"] as const;

/** The soft fill of each colour, for an answer that steps back. */
export const softFills: Record<(typeof optionTones)[number], string> = {
  coral: "bg-coral-soft-fill",
  champagne: "bg-champagne-soft-fill",
  blush: "bg-blush-soft-fill",
  sage: "bg-sage-soft-fill",
};

/** The soft fill of option A to D, for the options that weren't right once revealed. */
export const optionSoftFills = optionTones.map((tone) => softFills[tone]);
