export const supportedLanguages = ["sv", "en"] as const;
export type Language = (typeof supportedLanguages)[number];
export const defaultLanguage: Language = "sv";

const storageKey = "mingle.language";

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (supportedLanguages as readonly string[]).includes(value)
  );
}

interface LanguageSources {
  stored?: string | null;
  eventLanguage?: string | null;
}

/**
 * Picks the UI language: the user's own choice on this device wins, then the
 * event's language, then Swedish. The browser's language is deliberately
 * ignored: Swedish is the default for everyone.
 */
export function resolveLanguage({
  stored,
  eventLanguage,
}: LanguageSources): Language {
  if (isLanguage(stored)) return stored;
  if (isLanguage(eventLanguage)) return eventLanguage;
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
