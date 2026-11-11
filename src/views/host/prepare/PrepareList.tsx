import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { EventRow } from "@/api/events";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import type { PrepareGroup } from "@/lib/host/prepare-sections";
import type { PrepareSection } from "@/lib/host/panel-view";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId, type ModuleId } from "@/modules/registry";
import type { ModuleDefinition } from "@/modules/types";
import { cn } from "cn";

interface PrepareListProps {
  event: EventRow;
  groups: PrepareGroup[];
  /** The section whose editor is open; none on a phone showing the list. */
  current?: PrepareSection;
}

function definitionOf(id: ModuleId): ModuleDefinition | undefined {
  return Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
}

/** "10 questions", read through the hook the activity's definition names. */
function CountsText({
  id,
  event,
  definition,
}: {
  id: ModuleId;
  event: EventRow;
  definition: ModuleDefinition;
}) {
  const { t } = useTranslation();
  const counts = definition.useCounts?.(event);
  return counts ? t(`modules.${id}.items`, { count: counts.total }) : null;
}

function SummaryText({
  event,
  definition,
}: {
  event: EventRow;
  definition: ModuleDefinition;
}) {
  return definition.useSummary?.(event) ?? null;
}

/** What stands beside an activity's name: its count, or "off". */
function ActivityNote({ id, event }: { id: ModuleId; event: EventRow }) {
  const { t } = useTranslation();
  if (!event.enabled_modules.includes(id)) return t("hostPanel.prepare.off");
  const definition = definitionOf(id);
  if (definition?.useCounts) {
    return <CountsText id={id} event={event} definition={definition} />;
  }
  if (definition?.useSummary) {
    return <SummaryText event={event} definition={definition} />;
  }
  return null;
}

function SectionName({ section }: { section: PrepareSection }) {
  const { t } = useTranslation();
  return isModuleId(section)
    ? t(`modules.${section}.name`)
    : t(`hostPanel.prepare.sections.${section}`);
}

/**
 * The list of Prepare's sections in three groups. It is the navigation: each
 * row is a link that puts the section in the URL query, and the open one is
 * marked with `aria-current`.
 */
export function PrepareList({ event, groups, current }: PrepareListProps) {
  const { t } = useTranslation();
  const location = usePanelLocation();
  return (
    <nav
      aria-label={t("hostPanel.prepare.label")}
      data-testid="prepare-list"
      className="space-y-5"
    >
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`prepare-group-${group.id}`}
          className="space-y-1"
        >
          <h2
            id={`prepare-group-${group.id}`}
            className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted"
          >
            {t(`hostPanel.prepare.groups.${group.id}`)}
          </h2>
          <ul className="divide-y-[length:var(--border-thin)] divide-line">
            {group.sections.map((section) => (
              <li key={section}>
                <Link
                  to={location.to("prepare", section)}
                  data-testid={`section-link-${section}`}
                  aria-current={section === current ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 px-2 py-2 hover:bg-surface-sunken",
                    section === current && "bg-surface-sunken font-bold",
                    section === "end" && "text-danger-text",
                  )}
                >
                  <span className="font-display">
                    <SectionName section={section} />
                  </span>
                  <span className="text-sm font-normal text-ink-muted">
                    {isModuleId(section) && (
                      <ActivityNote id={section} event={event} />
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
