import type { ComponentType, Dispatch } from "react";
import type { EventRow, MemberRow } from "@/api/events";
import type { WizardAction, WizardDraft } from "@/lib/wizard/state";
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

/** What an activity's setup wizard step gets: the draft and how to change it. */
export interface ModuleWizardStepProps {
  draft: WizardDraft;
  dispatch: Dispatch<WizardAction>;
}

/** The control panel section also learns whether Start is allowed. */
export interface ModuleHostProps extends ModuleViewProps {
  code: string;
  hostKey: string;
  /** True while another activity runs; the panel shows the reason itself. */
  startDisabled: boolean;
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
  Host: ComponentType<ModuleHostProps>;
  /**
   * Hook giving the running activity's progress as ready text, such as
   * "question 3 of 10". Left out when the activity has none.
   */
  useProgress?: (event: EventRow) => string | undefined;
  /** An extra setup wizard step, for activities that need one. */
  WizardStep?: ComponentType<ModuleWizardStepProps>;
}
