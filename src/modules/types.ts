import type { ParseKeys } from "i18next";
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
  /**
   * The dashboard shows Start and the running controls itself, so the section
   * leaves them out and keeps only the list and its editing.
   */
  compact?: boolean;
}

/**
 * The running activity's controls. `part` lets the phone split them: the
 * status (question, answers) scrolls with the page, the actions (the one
 * "next" button and Stop) are pinned at the bottom. Defaults to both.
 */
export interface ModuleLiveProps extends ModuleHostProps {
  part?: "all" | "status" | "actions";
}

/** How far an activity has come: items in total and items played. */
export interface ActivityCounts {
  total: number;
  done: number;
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
  /**
   * Only the running state and its main actions (primary: the one "next"
   * button, secondary: Stop), shown first on the dashboard and the phone.
   * Renders nothing while the activity is not running. The `Host` section
   * reuses it, so the controls exist once.
   */
  Live?: ComponentType<ModuleLiveProps>;
  /** The activity's section in the control panel. */
  Host: ComponentType<ModuleHostProps>;
  /**
   * Hook giving the running activity's progress as ready text, such as
   * "question 3 of 10". Left out when the activity has none.
   */
  useProgress?: (event: EventRow) => string | undefined;
  /**
   * Hook giving the one-line summary for the activity's panel header, such as
   * "8 questions, not started". Left out when the activity has none.
   */
  useSummary?: (event: EventRow) => string | undefined;
  /**
   * Hook giving how many items the activity has and how many are done, for
   * the dashboard's progress bar. Left out when the activity has none.
   */
  useCounts?: (event: EventRow) => ActivityCounts | undefined;
  /**
   * i18n key of the Start button's label. Left out when the activity has no
   * Start of its own; Run then offers "Open" to its section in Prepare.
   */
  startLabelKey?: ParseKeys;
  /** An extra setup wizard step, for activities that need one. */
  WizardStep?: ComponentType<ModuleWizardStepProps>;
}
