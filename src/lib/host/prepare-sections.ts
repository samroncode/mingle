import { orderActivities } from "@/lib/host/host-panel";
import type { PrepareSection } from "@/lib/host/panel-view";

export type PrepareGroupId = "activities" | "evening" | "event";

export interface PrepareGroup {
  id: PrepareGroupId;
  sections: PrepareSection[];
}

/** What can still be read once the evening has ended; nothing is editable. */
const readableAfterEnd: readonly PrepareSection[] = [
  "costs",
  "guests",
  "links",
];

/**
 * The sections of Prepare in three groups: every activity (enabled ones in
 * the event's order, then the switched-off ones), the evening, and the event.
 * After the evening has ended only the readable sections are left.
 */
export function prepareGroups(
  enabledModules: string[],
  ended: boolean,
): PrepareGroup[] {
  const { enabled, disabled } = orderActivities(enabledModules);
  const groups: PrepareGroup[] = [
    { id: "activities", sections: [...enabled, ...disabled] },
    {
      id: "evening",
      sections: ["party", "program", "costs", "guests", "messages", "winners"],
    },
    { id: "event", sections: ["links", "brightroom", "end"] },
  ];
  return groups
    .map((group) => ({
      ...group,
      sections: ended
        ? group.sections.filter((section) => readableAfterEnd.includes(section))
        : group.sections,
    }))
    .filter((group) => group.sections.length > 0);
}

/**
 * The section to show: the requested one if the list has it, otherwise the
 * first in the list. Undefined only when the list is empty.
 */
export function currentSection(
  groups: PrepareGroup[],
  requested: PrepareSection,
): PrepareSection | undefined {
  const all = groups.flatMap((group) => group.sections);
  return all.includes(requested) ? requested : all[0];
}
