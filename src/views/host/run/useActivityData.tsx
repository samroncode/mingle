import { useCallback, useState } from "react";
import type { EventRow } from "@/api/events";
import type { ModuleId } from "@/modules/registry";
import { ActivityProbe, type ActivityData } from "./ActivityProbe";

type DataById = Partial<Record<ModuleId, ActivityData>>;

function sameData(a: ActivityData | undefined, b: ActivityData): boolean {
  return (
    a?.summary === b.summary &&
    a?.counts?.total === b.counts?.total &&
    a?.counts?.done === b.counts?.done
  );
}

/** Summaries and counts of the given activities, kept up to date by probes. */
export function useActivityData(ids: readonly ModuleId[], event: EventRow) {
  const [data, setData] = useState<DataById>({});
  const onData = useCallback((id: ModuleId, next: ActivityData) => {
    setData((prev) =>
      sameData(prev[id], next) ? prev : { ...prev, [id]: next },
    );
  }, []);
  const probes = ids.map((id) => (
    <ActivityProbe key={id} id={id} event={event} onData={onData} />
  ));
  return { data, probes };
}
