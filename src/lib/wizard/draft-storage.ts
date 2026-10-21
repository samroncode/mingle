import { z } from "zod";
import { supportedLanguages } from "@/i18n/language";
import { moduleIds } from "@/modules/registry";
import { nicheIds } from "@/niches/ids";
import { stepOrder, type WizardDraft } from "./state";

const storageKey = "mingle.wizard-draft";

// The draft holds what the host typed, valid or not, so strings only get a
// generous cap here; the party schema judges them at Create.
const typedText = z.string().max(5000);

const DraftSchema = z.strictObject({
  step: z.enum(stepOrder),
  niche: z.enum(nicheIds),
  language: z.enum(supportedLanguages),
  enabledModules: z.array(z.enum(moduleIds)).max(moduleIds.length),
  party: z.strictObject({
    welcome: typedText,
    welcomeEdited: z.boolean(),
    menu: z.array(typedText).max(50),
    schedule: z
      .array(z.strictObject({ time: typedText, title: typedText }))
      .max(50),
    wifiSsid: typedText,
    wifiPassword: typedText,
    musicUrl: typedText,
  }),
});

// Storage can be unavailable (private mode, blocked site data). The wizard
// then works as usual and just doesn't remember.

/** The saved draft, or undefined if there is none or it can't be trusted. */
export function loadDraft(): WizardDraft | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return undefined;
    const result = DraftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function saveDraft(draft: WizardDraft): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // See the note above.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // See the note above.
  }
}
