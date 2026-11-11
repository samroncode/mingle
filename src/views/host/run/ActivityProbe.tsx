import { useEffect } from "react";
import type { EventRow } from "@/api/events";
import { moduleDefinitions } from "@/modules/definitions";
import type { ModuleId } from "@/modules/registry";
import type { ActivityCounts, ModuleDefinition } from "@/modules/types";
import { useActivitySummary } from "@/modules/useActivitySummary";

/** What Run knows about one activity: its summary line and its counts. */
export interface ActivityData {
  summary?: string;
  counts?: ActivityCounts;
}

interface ProbeProps {
  id: ModuleId;
  event: EventRow;
  onData: (id: ModuleId, data: ActivityData) => void;
}

function Report({ id, onData, summary, counts }: ProbeProps & ActivityData) {
  const total = counts?.total;
  const done = counts?.done;
  useEffect(() => {
    onData(id, {
      summary,
      counts:
        total === undefined || done === undefined ? undefined : { total, done },
    });
  }, [id, onData, summary, total, done]);
  return null;
}

/** Each definition's hooks are called from a component of their own. */
function CountsProbe({
  definition,
  ...props
}: ProbeProps & { definition: ModuleDefinition }) {
  const counts = definition.useCounts?.(props.event);
  const summary = useActivitySummary(props.id, props.event, counts ?? null);
  return <Report {...props} summary={summary} counts={counts} />;
}

function SummaryProbe({
  definition,
  ...props
}: ProbeProps & { definition: ModuleDefinition }) {
  const summary = definition.useSummary?.(props.event);
  return <Report {...props} summary={summary} />;
}

/** Reads an activity's summary and counts and reports them; renders nothing. */
export function ActivityProbe(props: ProbeProps) {
  const definition = Object.hasOwn(moduleDefinitions, props.id)
    ? moduleDefinitions[props.id]
    : undefined;
  if (definition?.useCounts)
    return <CountsProbe {...props} definition={definition} />;
  if (definition?.useSummary)
    return <SummaryProbe {...props} definition={definition} />;
  return null;
}
