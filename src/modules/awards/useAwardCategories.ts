import { listAwardCategories, type AwardCategoryView } from "@/api/awards";
import { useLoad } from "@/hooks/useLoad";

export type AwardCategoriesState =
  | { status: "loading" }
  | { status: "ready"; categories: AwardCategoryView[] }
  | { status: "error" };

/** Loads the event's award categories once, when the component mounts. */
export function useAwardCategories(eventId: string): AwardCategoriesState {
  const state = useLoad(eventId, () => listAwardCategories(eventId));
  return state.status === "ready"
    ? { status: "ready", categories: state.value }
    : state;
}
