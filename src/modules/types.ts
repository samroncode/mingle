import type { ComponentType } from "react";
import type { EventRow, MemberRow } from "@/api/events";
import type { ModuleId } from "./registry";

/**
 * What every view of an activity gets: the live event snapshot and its
 * members. A view loads anything else through its own `src/api/<name>` file.
 */
export interface ModuleViewProps {
  event: EventRow;
  members: MemberRow[];
}

/** The guest view also knows which member is looking at their phone. */
export interface ModuleGuestViewProps extends ModuleViewProps {
  userId: string;
}

/** One activity (module in code): its id, name and the views it plugs in. */
export interface ModuleDefinition {
  id: ModuleId;
  /** i18n key of the activity's name. */
  nameKey: string;
  /** The left side of the TV while the activity runs. */
  Tv: ComponentType<ModuleViewProps>;
  /** The guest page while the activity runs. */
  Guest: ComponentType<ModuleGuestViewProps>;
  /** The activity's section in the control panel. */
  Host: ComponentType<ModuleViewProps>;
  /** An extra setup wizard step, for activities that need one. */
  WizardStep?: ComponentType;
}
