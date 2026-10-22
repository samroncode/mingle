import { moduleDefinitions } from "./definitions";
import type { ModuleDefinition } from "./types";

type Definitions = Partial<Record<string, ModuleDefinition>>;

/** The party screen, or the view of the activity that is running. */
export type ScreenChoice =
  { kind: "party" } | { kind: "module"; definition: ModuleDefinition };

/**
 * Chooses what the TV and the guest page show from the event's current
 * module. Anything without a definition (no module, an activity that has no
 * views yet, an id this app doesn't know) keeps the party screen.
 */
export function pickScreen(
  currentModule: string | null,
  definitions: Definitions = moduleDefinitions,
): ScreenChoice {
  const definition = currentModule
    ? Object.hasOwn(definitions, currentModule)
      ? definitions[currentModule]
      : undefined
    : undefined;
  return definition ? { kind: "module", definition } : { kind: "party" };
}
