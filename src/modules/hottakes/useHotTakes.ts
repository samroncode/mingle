import { useEffect, useState } from "react";
import { listHotTakes, type HotTakeView } from "@/api/hottakes";

export type HotTakesState =
  | { status: "loading" }
  | { status: "ready"; takes: HotTakeView[] }
  | { status: "error" };

/** Loads the event's hot takes once, when the component mounts. */
export function useHotTakes(eventId: string): HotTakesState {
  const [loaded, setLoaded] = useState<{
    eventId: string;
    state: HotTakesState;
  }>();

  useEffect(() => {
    let stale = false;
    void listHotTakes(eventId).then((result) => {
      if (stale) return;
      setLoaded({
        eventId,
        state: result.ok
          ? { status: "ready", takes: result.value }
          : { status: "error" },
      });
    });
    return () => {
      stale = true;
    };
  }, [eventId]);

  return loaded?.eventId === eventId ? loaded.state : { status: "loading" };
}
