import type { ReactNode } from "react";
import { getNiche, isNicheId } from "@/niches";
import { nicheThemeStyle } from "@/niches/theme";

interface NicheThemeProps {
  /** A niche id from the database; an unknown one is left unthemed. */
  niche: string;
  children: ReactNode;
}

/**
 * Applies a niche's token overrides to everything inside it. The wrapper paints
 * its own background and text color, because `body` reads the `:root` tokens.
 */
export function NicheTheme({ niche, children }: NicheThemeProps) {
  if (!isNicheId(niche)) return <>{children}</>;
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
