import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";
import type { ModuleLiveProps } from "@/modules/types";

/** The running activity's Live part, or nothing. Looked up by id, never held. */
export function RunningLive(props: ModuleLiveProps) {
  const id = props.event.current_module;
  if (!isModuleId(id) || !Object.hasOwn(moduleDefinitions, id)) return null;
  const Live = moduleDefinitions[id]?.Live;
  return Live ? <Live {...props} /> : null;
}
