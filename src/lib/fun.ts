export const funLevels = ["calm", "playful", "party"] as const;
export type FunLevel = (typeof funLevels)[number];

/** The level in force where no FunZone is set; theme.css gives the same default. */
export const defaultFunLevel: FunLevel = "playful";
