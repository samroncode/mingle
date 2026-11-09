import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";

interface NowPanelProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  /** The evening has ended: nothing runs, so the panel is hidden. */
  ended?: boolean;
}

/**
 * What is running now, first on the page: the running activity's `Live`
 * controls, or a calm line when nothing runs. Hidden after the evening ended.
 */
export function NowPanel({ event, members, hostKey, ended }: NowPanelProps) {
  const { t } = useTranslation();
  if (ended || event.status === "ended") return null;
  const id = event.current_module;
  const Live =
    isModuleId(id) && Object.hasOwn(moduleDefinitions, id)
      ? moduleDefinitions[id]?.Live
      : undefined;
  return (
    <section
      data-testid="now-panel"
      aria-label={t("hostPanel.now.title")}
      className="space-y-3"
    >
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
        {t("hostPanel.now.title")}
      </h2>
      {Live ? (
        <Live
          event={event}
          members={members}
          code={event.code}
          hostKey={hostKey}
          startDisabled={false}
        />
      ) : (
        <p data-testid="now-empty" className="text-ink-muted">
          {t("hostPanel.now.empty")}
        </p>
      )}
    </section>
  );
}
