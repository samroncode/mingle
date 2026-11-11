import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { EventRow } from "@/api/events";
import { Button } from "@/components/ui/button";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import { upNext } from "@/lib/host/up-next";
import { moduleDefinitions } from "@/modules/definitions";
import { RunControls } from "@/modules/RunControls";
import type { ModuleId } from "@/modules/registry";
import { useActivityData } from "./useActivityData";

function Action({
  id,
  event,
  hostKey,
  primary,
}: {
  id: ModuleId;
  event: EventRow;
  hostKey: string;
  primary: boolean;
}) {
  const { t } = useTranslation();
  const location = usePanelLocation();
  const definition = Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
  if (!definition?.startLabelKey) {
    return (
      <Button asChild variant="link" className="shadow-none!">
        <Link to={location.to("prepare", id)}>{t("hostPanel.run.open")}</Link>
      </Button>
    );
  }
  return (
    <RunControls
      code={event.code}
      hostKey={hostKey}
      module={id}
      running={false}
      startDisabled={false}
      startLabelKey={definition.startLabelKey}
      next={null}
      quietStart={!primary}
    />
  );
}

interface RowProps {
  id: ModuleId;
  event: EventRow;
  hostKey: string;
  summary?: string;
  primary: boolean;
  played: boolean;
}

function Row({ id, event, hostKey, summary, primary, played }: RowProps) {
  const { t } = useTranslation();
  return (
    <li
      data-testid={`activity-${id}`}
      data-up-next={primary || undefined}
      className={`flex flex-col gap-3 border-b-[length:var(--border-thin)] border-line sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${
        primary ? "py-6" : "py-4"
      }`}
    >
      <div className="min-w-0">
        {primary && (
          <p className="font-display text-xs font-bold tracking-wide text-sage-text uppercase">
            {t("hostPanel.run.upNext")}
          </p>
        )}
        <h3
          className={`font-display font-bold ${
            primary ? "text-2xl lg:text-3xl" : "text-lg lg:text-xl"
          } ${played ? "text-ink-muted" : ""}`}
        >
          {t(`modules.${id}.name`)}
        </h3>
        {summary && <p className="text-sm text-ink-muted">{summary}</p>}
      </div>
      <div className="[&_button]:w-full sm:[&_button]:w-auto sm:[&_button]:px-8 [&_a]:w-full sm:[&_a]:w-auto">
        <Action id={id} event={event} hostKey={hostKey} primary={primary} />
      </div>
    </li>
  );
}

interface ActivityRowsProps {
  ids: ModuleId[];
  event: EventRow;
  hostKey: string;
}

/** Nothing running: the enabled activities as flat rows, one of them up next. */
export function ActivityRows({ ids, event, hostKey }: ActivityRowsProps) {
  const { data, probes } = useActivityData(ids, event);
  const counts = Object.fromEntries(ids.map((id) => [id, data[id]?.counts]));
  const next = upNext(ids, counts);
  return (
    <>
      {probes}
      <ul className="border-t-[length:var(--border-thin)] border-line">
        {ids.map((id) => {
          const c = data[id]?.counts;
          return (
            <Row
              key={id}
              id={id}
              event={event}
              hostKey={hostKey}
              summary={data[id]?.summary}
              primary={next === id}
              played={!!c && c.total > 0 && c.done >= c.total}
            />
          );
        })}
      </ul>
    </>
  );
}

/** An activity is running: the others as names and summaries, no buttons. */
export function OtherActivities({
  ids,
  event,
  running,
}: {
  ids: ModuleId[];
  event: EventRow;
  running: ModuleId;
}) {
  const { t } = useTranslation();
  const { data, probes } = useActivityData(ids, event);
  if (ids.length === 0) return null;
  return (
    <section data-testid="run-others" className="space-y-3">
      {probes}
      <h2 className="font-display text-sm font-bold tracking-wide text-ink-muted uppercase">
        {t("hostPanel.run.startNext", {
          name: t(`modules.${running}.name`).toLowerCase(),
        })}
      </h2>
      <ul className="flex flex-wrap gap-x-8 gap-y-3">
        {ids.map((id) => (
          <li key={id} data-testid={`activity-${id}`}>
            <h3 className="font-display text-lg font-bold">
              {t(`modules.${id}.name`)}
            </h3>
            {data[id]?.summary && (
              <p className="text-sm text-ink-muted">{data[id]?.summary}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
