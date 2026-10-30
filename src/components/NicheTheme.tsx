import { useEffect, type ReactNode } from "react";
import { getNiche, isNicheId } from "@/niches";
import { nicheThemeStyle } from "@/niches/theme";

/** The light theme a bright room uses instead of the niche's own. */
const brightThemeId = "day";

interface NicheThemeProps {
  /** A niche id from the database; an unknown one is left unthemed. */
  niche: string;
  /** The host switched on the light theme for a bright room. */
  bright?: boolean;
  children: ReactNode;
}

/**
 * Applies a niche's theme and token overrides to everything inside it. The wrapper paints
 * its own background and text color, because `body` reads the `:root` tokens.
 */
export function NicheTheme({
  niche,
  bright = false,
  children,
}: NicheThemeProps) {
  // The layouts' own controls (the language switcher) sit outside this wrapper,
  // so a bright room also themes the page root until it is switched off.
  useEffect(() => {
    if (!bright) return;
    const root = document.documentElement;
    root.dataset.theme = brightThemeId;
    return () => {
      delete root.dataset.theme;
    };
  }, [bright]);
  if (!isNicheId(niche)) return <>{children}</>;
  const { theme } = getNiche(niche);
  return (
    <div
      data-niche={niche}
      data-theme={bright ? brightThemeId : theme.id}
      style={nicheThemeStyle(theme)}
      className="bg-background text-foreground"
    >
      {children}
    </div>
  );
}
