import type { ReactNode } from "react";
import { getNiche, type NicheId } from "@/niches";
import { nicheThemeStyle } from "@/niches/theme";

interface NicheThemeProps {
  niche: NicheId;
  children: ReactNode;
}

/**
 * Applies a niche's token overrides to everything inside it. The wrapper paints
 * its own background and text color, because `body` reads the `:root` tokens.
 */
export function NicheTheme({ niche, children }: NicheThemeProps) {
  return (
    <div
      data-niche={niche}
      style={nicheThemeStyle(getNiche(niche).theme)}
      className="bg-background text-foreground"
    >
      {children}
    </div>
  );
}
