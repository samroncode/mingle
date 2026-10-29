import type { HostActionError } from "@/api/host-actions";
import type { EventRow } from "@/api/events";
import { moduleIds, type ModuleId } from "@/modules/registry";

/** What the top bar says the TV shows, as an i18n key plus its values. */
export type TvNow = {
  key:
    | "hostPanel.tv.party"
    | "hostPanel.tv.ended"
    | `hostPanel.tv.${"activity" | "withProgress"}.${"idle" | "open" | "revealed"}`;
  values: { name?: string; progress?: string };
};

/**
 * What the TV shows right now. `name` and `progress` come from the running
 * activity; a missing progress leaves just the name and the phase.
 */
export function tvNow(
  event: Pick<EventRow, "status" | "current_module" | "phase">,
  name: string | undefined,
  progress: string | undefined,
): TvNow {
  if (event.status === "ended")
    return { key: "hostPanel.tv.ended", values: {} };
  if (!event.current_module || !name) {
    return { key: "hostPanel.tv.party", values: {} };
  }
  const phase =
    event.phase === "open" || event.phase === "revealed" ? event.phase : "idle";
  return {
    key: `hostPanel.tv.${progress ? "withProgress" : "activity"}.${phase}`,
    values: { name, progress: progress ?? "" },
  };
}

/** The activities split for the panel: enabled in their order, then the rest. */
export function orderActivities(
  enabledModules: string[],
  all: readonly ModuleId[] = moduleIds,
): { enabled: ModuleId[]; disabled: ModuleId[] } {
  const known = new Set<string>(all);
  const enabled = enabledModules.filter(
    (id, index): id is ModuleId =>
      known.has(id) && enabledModules.indexOf(id) === index,
  );
  return { enabled, disabled: all.filter((id) => !enabled.includes(id)) };
}

/** i18n key of the message for a failed host action. */
export function hostPanelErrorKey(error: HostActionError) {
  switch (error) {
    case "rate_limited":
    case "network_error":
    case "not_authorized":
    case "invalid_transition":
    case "module_disabled":
    case "module_empty":
    case "module_finished":
    case "invalid_request":
    case "not_found":
    case "name_taken":
    case "invalid_name":
    case "invalid_sharer":
      return `hostPanel.errors.${error}` as const;
    case "not_authenticated":
      return "hostPanel.errors.not_authorized" as const;
    case "payload_too_large":
      return "hostPanel.errors.invalid_request" as const;
    default:
      return "hostPanel.errors.internal_error" as const;
  }
}
