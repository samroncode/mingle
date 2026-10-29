import type { HotTakeView, HotTakeProgress } from "@/api/hottakes";
import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { Language } from "@/i18n/language";
import type { UpdateHotTakesResponse } from "@/lib/schemas/host-actions";
import type { HotTake } from "@/lib/schemas/hottakes";
import {
  invalidOwnHotTakeKeys,
  toHotTakes,
  type HotTakesDraft,
  type HotTakesItem,
} from "@/lib/wizard/hottakes";
import { getNiche, type NicheId } from "@/niches";
import { hostPanelErrorKey } from "./host-panel";

/** The event's hot takes split for the control panel's editor. */
export interface HotTakesEdit {
  /** Revealed takes, shown locked before the list. */
  revealed: HotTakeView[];
  /** The unrevealed takes as the wizard's hot takes editor edits them. */
  draft: HotTakesDraft;
  /** Ready-made takes already revealed, so they aren't offered again. */
  hiddenIds: string[];
}

/**
 * The event's hot takes as the editor shows them. A hot take whose text is
 * one of the niche's ready-made takes in the event language counts as
 * that one again, so the host can remove and re-add it like in the wizard;
 * any other hot take is the host's own, keyed by its id.
 */
export function hotTakesToDraft(
  niche: NicheId,
  language: Language,
  takes: HotTakeView[],
): HotTakesEdit {
  const ready = getNiche(niche).hottakes.map((content) => ({
    id: content.id,
    text: content.texts[language],
  }));
  const used = new Set<string>();
  const readyId = (take: HotTakeView) => {
    const match = ready.find((r) => !used.has(r.id) && r.text === take.text);
    if (match) used.add(match.id);
    return match?.id;
  };

  const revealed = takes.filter((c) => c.revealed);
  const hiddenIds = revealed.flatMap((c) => readyId(c) ?? []);
  const items = takes
    .filter((c) => !c.revealed)
    .map((c): HotTakesItem => {
      const id = readyId(c);
      return id
        ? { kind: "builtin", id }
        : { kind: "own", key: c.id, text: c.text };
    });
  return { revealed, draft: { seeded: true, items }, hiddenIds };
}

export type HotTakesSaveResult =
  | { ok: true }
  | { ok: false; invalid: string[] }
  | { ok: false; error: HostActionError };

type SendHotTakes = (input: {
  code: string;
  key: string;
  takes: HotTake[];
}) => Promise<HostActionResult<UpdateHotTakesResponse>>;

/**
 * Checks the host's own takes and sends the unrevealed list, which
 * replaces the unrevealed takes of the event. Revealed ones are never
 * sent.
 */
export async function saveHotTakesEdit(
  niche: NicheId,
  language: Language,
  draft: HotTakesDraft,
  target: { code: string; key: string },
  send: SendHotTakes,
): Promise<HotTakesSaveResult> {
  const invalid = invalidOwnHotTakeKeys(draft);
  if (invalid.length > 0) return { ok: false, invalid };
  const result = await send({
    ...target,
    takes: toHotTakes(niche, language, draft),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Whether the host may change the unrevealed takes now: not while a
 * hot take is open or revealed, not once every hot take is revealed, and not
 * after the evening. host-actions checks the same.
 */
export function canEditHotTakes(
  event: { status: string; current_module: string | null; phase: string },
  progress: HotTakeProgress,
): boolean {
  if (event.status === "ended") return false;
  if (event.current_module === "hottakes" && event.phase !== "idle")
    return false;
  return !(progress.total > 0 && progress.revealed >= progress.total);
}

/** i18n key of the message for a failed hot takes edit. */
export function hotTakesEditErrorKey(error: HostActionError) {
  switch (error) {
    case "invalid_transition":
    case "module_disabled":
    case "invalid_request":
      return `modules.hottakes.edit.errors.${error}` as const;
    case "payload_too_large":
      return "modules.hottakes.edit.errors.invalid_request" as const;
    default:
      return hostPanelErrorKey(error);
  }
}
