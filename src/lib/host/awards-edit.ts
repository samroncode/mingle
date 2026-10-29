import type { AwardCategoryView, AwardProgress } from "@/api/awards";
import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { Language } from "@/i18n/language";
import type { UpdateAwardsResponse } from "@/lib/schemas/host-actions";
import type { AwardCategory } from "@/lib/schemas/awards";
import {
  invalidOwnAwardKeys,
  toAwardCategories,
  type AwardsDraft,
  type AwardsItem,
} from "@/lib/wizard/awards";
import { getNiche, type NicheId } from "@/niches";
import { hostPanelErrorKey } from "./host-panel";

/** The event's award categories split for the control panel's editor. */
export interface AwardsEdit {
  /** Revealed categories, shown locked before the list. */
  revealed: AwardCategoryView[];
  /** The unrevealed categories as the wizard's awards editor edits them. */
  draft: AwardsDraft;
  /** Ready-made categories already revealed, so they aren't offered again. */
  hiddenIds: string[];
}

/**
 * The event's categories as the editor shows them. A category whose text is
 * one of the niche's ready-made categories in the event language counts as
 * that one again, so the host can remove and re-add it like in the wizard;
 * any other category is the host's own, keyed by its id.
 */
export function awardsToDraft(
  niche: NicheId,
  language: Language,
  categories: AwardCategoryView[],
): AwardsEdit {
  const ready = getNiche(niche).awards.map((content) => ({
    id: content.id,
    text: content.texts[language],
  }));
  const used = new Set<string>();
  const readyId = (category: AwardCategoryView) => {
    const match = ready.find(
      (r) => !used.has(r.id) && r.text === category.text,
    );
    if (match) used.add(match.id);
    return match?.id;
  };

  const revealed = categories.filter((c) => c.revealed);
  const hiddenIds = revealed.flatMap((c) => readyId(c) ?? []);
  const items = categories
    .filter((c) => !c.revealed)
    .map((c): AwardsItem => {
      const id = readyId(c);
      return id
        ? { kind: "builtin", id }
        : { kind: "own", key: c.id, text: c.text };
    });
  return { revealed, draft: { seeded: true, items }, hiddenIds };
}

export type AwardsSaveResult =
  | { ok: true }
  | { ok: false; invalid: string[] }
  | { ok: false; error: HostActionError };

type SendAwards = (input: {
  code: string;
  key: string;
  categories: AwardCategory[];
}) => Promise<HostActionResult<UpdateAwardsResponse>>;

/**
 * Checks the host's own categories and sends the unrevealed list, which
 * replaces the unrevealed categories of the event. Revealed ones are never
 * sent.
 */
export async function saveAwardsEdit(
  niche: NicheId,
  language: Language,
  draft: AwardsDraft,
  target: { code: string; key: string },
  send: SendAwards,
): Promise<AwardsSaveResult> {
  const invalid = invalidOwnAwardKeys(draft);
  if (invalid.length > 0) return { ok: false, invalid };
  const result = await send({
    ...target,
    categories: toAwardCategories(niche, language, draft),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Whether the host may change the unrevealed categories now: not while a
 * category is open or revealed, not once every category is revealed, and not
 * after the evening. host-actions checks the same.
 */
export function canEditAwards(
  event: { status: string; current_module: string | null; phase: string },
  progress: AwardProgress,
): boolean {
  if (event.status === "ended") return false;
  if (event.current_module === "awards" && event.phase !== "idle") return false;
  return !(progress.total > 0 && progress.revealed >= progress.total);
}

/** i18n key of the message for a failed awards edit. */
export function awardsEditErrorKey(error: HostActionError) {
  switch (error) {
    case "invalid_transition":
    case "module_disabled":
    case "invalid_request":
      return `modules.awards.edit.errors.${error}` as const;
    case "payload_too_large":
      return "modules.awards.edit.errors.invalid_request" as const;
    default:
      return hostPanelErrorKey(error);
  }
}
