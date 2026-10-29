import type { ReactNode } from "react";
import { getNiche, isNicheId } from "@/niches";
import { nicheThemeStyle } from "@/niches/theme";

interface NicheThemeProps {
  /** A niche id from the database; an unknown one is left unthemed. */
  niche: string;
  children: ReactNode;
}

/**
 * Applies a niche's theme and token overrides to everything inside it. The wrapper paints
 * its own background and text color, because `body` reads the `:root` tokens.
 */
export function NicheTheme({ niche, children }: NicheThemeProps) {
  if (!isNicheId(niche)) return <>{children}</>;
  const { theme } = getNiche(niche);
  return (
    <div
      data-niche={niche}
      data-theme={theme.id}
      style={nicheThemeStyle(theme)}
      className="bg-background text-foreground"
    >
      {children}
    </div>
  );
}
