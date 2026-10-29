import { z } from "zod";
import { supportedLanguages } from "@/i18n/language";
import { partyLimits } from "@/lib/schemas/party";
import { awardsLimits } from "@/lib/schemas/awards";
import { hottakesLimits } from "@/lib/schemas/hottakes";
import { quizLimits } from "@/lib/schemas/quiz";
import { moduleIds } from "@/modules/registry";
import { nicheIds } from "@/niches/ids";
import { emptyAwards } from "./awards";
import { emptyHotTakes } from "./hottakes";
import { emptyQuiz } from "./quiz";
import { stepOrder, type WizardDraft } from "./state";

const storageKey = "mingle.wizard-draft";

// The draft holds what the host typed, valid or not, so its caps are at least
// the party schema's (which judges it at Create): anything the wizard lets the
// host type survives a reload. `satisfies` keeps it in step with WizardDraft.
const typedText = z.string().max(5000);
const maxLines = partyLimits.lines;

// A question being typed may be unfinished, so its parts can be empty.
const QuizItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("builtin"), id: z.string().max(100) }),
  z.strictObject({
    kind: z.literal("own"),
    key: z.string().max(100),
    text: typedText,
    options: z.tuple([typedText, typedText, typedText, typedText]),
    correct: z.number().int().min(0).max(3),
  }),
]);

// A category being typed may be unfinished, so its text can be empty.
const AwardsItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("builtin"), id: z.string().max(100) }),
  z.strictObject({
    kind: z.literal("own"),
    key: z.string().max(100),
    text: typedText,
  }),
]);

// A hot take being typed may be unfinished, so its text can be empty.
const HotTakesItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("builtin"), id: z.string().max(100) }),
  z.strictObject({
    kind: z.literal("own"),
    key: z.string().max(100),
    text: typedText,
  }),
]);

const DraftSchema = z.strictObject({
  step: z.enum(stepOrder),
  niche: z.enum(nicheIds),
  language: z.enum(supportedLanguages),
  enabledModules: z.array(z.enum(moduleIds)).max(moduleIds.length),
  // Drafts saved before the quiz step existed have none.
  quiz: z
    .strictObject({
      seeded: z.boolean(),
      items: z.array(QuizItemSchema).max(quizLimits.questions),
    })
    .default(emptyQuiz),
  // Drafts saved before the awards step existed have none.
  awards: z
    .strictObject({
      seeded: z.boolean(),
      items: z.array(AwardsItemSchema).max(awardsLimits.categories),
    })
    .default(emptyAwards),
  // Drafts saved before the hot takes step existed have none.
  hottakes: z
    .strictObject({
      seeded: z.boolean(),
      items: z.array(HotTakesItemSchema).max(hottakesLimits.takes),
    })
    .default(emptyHotTakes),
  party: z.strictObject({
    welcome: typedText,
    welcomeEdited: z.boolean(),
    menu: z.array(typedText).max(maxLines),
    schedule: z
      .array(z.strictObject({ time: typedText, title: typedText }))
      .max(maxLines),
    wifiSsid: typedText,
    wifiPassword: typedText,
    musicUrl: typedText,
  }),
}) satisfies z.ZodType<WizardDraft>;

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
