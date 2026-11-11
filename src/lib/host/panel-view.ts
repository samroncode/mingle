import { moduleIds } from "@/modules/registry";

/** The control panel's two views: preparing the evening, and running it. */
export const panelViews = ["prepare", "run"] as const;
export type PanelView = (typeof panelViews)[number];

/** The sections of Prepare, in the order of its list; the first is the default. */
export const prepareSections = [
  ...moduleIds,
  "party",
  "program",
  "costs",
  "guests",
  "messages",
  "winners",
  "links",
  "brightroom",
  "end",
] as const;
export type PrepareSection = (typeof prepareSections)[number];

export interface PanelLocation {
  view: PanelView;
  section: PrepareSection;
  /** The query named a known section, so the host asked for that one. */
  hasSection: boolean;
}

const firstSection: PrepareSection = prepareSections[0];

function isView(value: string | null): value is PanelView {
  return panelViews.some((view) => view === value);
}

function isSection(value: string | null): value is PrepareSection {
  return prepareSections.some((section) => section === value);
}

/**
 * Reads the view and the Prepare section from a URL query (`?view=…`). The
 * admin key stays alone in the fragment. Unknown or missing values fall back
 * to Prepare and to the first section, without an error.
 */
export function readPanelLocation(search: string): PanelLocation {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const section = params.get("section");
  return {
    view: isView(view) ? view : "prepare",
    section: isSection(section) ? section : firstSection,
    hasSection: isSection(section),
  };
}

/**
 * The query for a view, keeping every other parameter. Prepare is the
 * default view, so it needs no `view` parameter; Run writes `view=run` and
 * carries no section. `section` is only written for Prepare.
 */
export function panelSearch(
  search: string,
  view: PanelView,
  section?: PrepareSection,
): string {
  const params = new URLSearchParams(search);
  params.delete("view");
  params.delete("section");
  if (view === "run") params.set("view", "run");
  else if (section) params.set("section", section);
  const text = params.toString();
  return text ? `?${text}` : "";
}
