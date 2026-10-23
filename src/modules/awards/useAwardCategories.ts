import { useEffect, useState } from "react";
import { listAwardCategories, type AwardCategoryView } from "@/api/awards";

export type AwardCategoriesState =
  | { status: "loading" }
  | { status: "ready"; categories: AwardCategoryView[] }
  | { status: "error" };

/** Loads the event's award categories once, when the component mounts. */
export function useAwardCategories(eventId: string): AwardCategoriesState {
  const [loaded, setLoaded] = useState<{
    eventId: string;
    state: AwardCategoriesState;
  }>();

  useEffect(() => {
    let stale = false;
    void listAwardCategories(eventId).then((result) => {
      if (stale) return;
      setLoaded({
        eventId,
        state: result.ok
          ? { status: "ready", categories: result.value }
          : { status: "error" },
      });
    });
    return () => {
      stale = true;
    };
  }, [eventId]);

  return loaded?.eventId === eventId ? loaded.state : { status: "loading" };
}
