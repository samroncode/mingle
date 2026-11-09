import type { EventRow } from "@/api/events";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";

/** Whether the running activity has a Live part. */
export function hasLive(event: EventRow): boolean {
  const id = event.current_module;
  return (
    isModuleId(id) &&
    Object.hasOwn(moduleDefinitions, id) &&
    !!moduleDefinitions[id]?.Live
  );
}
