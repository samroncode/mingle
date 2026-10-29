import type { CSSProperties } from "react";
import type { NicheConfig } from "./types";

/** Turns a niche's token overrides into CSS custom properties, e.g. `{ "--primary": "…" }`. */
export function nicheThemeStyle(theme: NicheConfig["theme"]): CSSProperties {
  const style: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.overrides)) {
    style[`--${token}`] = value;
  }
  return style;
}
