/** The fill of option A to D: coral, champagne, blush, sage. */
export const optionFills = [
  "bg-coral",
  "bg-champagne",
  "bg-blush",
  "bg-sage",
] as const;

/** The soft fill of option A to D, for the options that weren't right once revealed. */
export const optionSoftFills = [
  "bg-coral-soft-fill",
  "bg-champagne-soft-fill",
  "bg-blush-soft-fill",
  "bg-sage-soft-fill",
] as const;

/** The same four colours as choice tile fills, for guest answer tiles. */
export const optionTones = ["coral", "champagne", "blush", "sage"] as const;
