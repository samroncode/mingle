import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { SetModulesResponse } from "@/lib/schemas/host-actions";
import type { ModuleId } from "@/modules/registry";

/** The enabled list after switching `id` on (at the end, as in the wizard) or off. */
export function withActivity(
  enabled: readonly ModuleId[],
  id: ModuleId,
  on: boolean,
): ModuleId[] {
  const rest = enabled.filter((other) => other !== id);
  return on ? [...rest, id] : rest;
}

export type SwitchResult =
  /** `pickFailed`: switched on, but its ready-made list couldn't be added. */
  { ok: true; pickFailed: boolean } | { ok: false; error: HostActionError };

interface SwitchInput {
  enabled: readonly ModuleId[];
  id: ModuleId;
  on: boolean;
  send: (modules: ModuleId[]) => Promise<HostActionResult<SetModulesResponse>>;
  /** Saves the activity's default pick; only called when switching on. */
  pick: () => Promise<{ ok: boolean }>;
}

/**
 * Saves the new list, and when an activity was switched on, its default
 * pick. A pick that fails leaves the activity on, with its list editable.
 */
export async function switchActivity({
  enabled,
  id,
  on,
  send,
  pick,
}: SwitchInput): Promise<SwitchResult> {
  const saved = await send(withActivity(enabled, id, on));
  if (!saved.ok) return { ok: false, error: saved.error };
  if (!on) return { ok: true, pickFailed: false };
  const picked = await pick().catch(() => ({ ok: false }));
  return { ok: true, pickFailed: !picked.ok };
}
