export const supportedLanguages = ["sv", "en"] as const;
export type Language = (typeof supportedLanguages)[number];
export const defaultLanguage: Language = "en";

const storageKey = "mingle.language";

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (supportedLanguages as readonly string[]).includes(value)
  );
}

/** Maps a browser locale such as "sv-SE" to a supported language. */
function fromLocale(locale: string): Language | undefined {
  const base = locale.toLowerCase().split("-")[0];
  return isLanguage(base) ? base : undefined;
}

interface LanguageSources {
  stored?: string | null;
  eventLanguage?: string | null;
  browserLanguages?: readonly string[];
}

/**
 * Picks the UI language: the user's own choice on this device wins, then the
 * event's language, then the browser's, then English.
 */
export function resolveLanguage({
  stored,
  eventLanguage,
  browserLanguages = [],
}: LanguageSources): Language {
  if (isLanguage(stored)) return stored;
  if (isLanguage(eventLanguage)) return eventLanguage;
  for (const locale of browserLanguages) {
    const language = fromLocale(locale);
    if (language) return language;
  }
  return defaultLanguage;
}

// Storage can be unavailable (private mode, blocked site data). The choice
// then only lasts for the current visit.

export function loadStoredLanguage(): Language | undefined {
  try {
    const value = localStorage.getItem(storageKey);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // See the note above.
  }
}
