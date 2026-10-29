import { listAwardVoters } from "@/api/awards";
import { useLoad } from "@/hooks/useLoad";

/**
 * The ids of the guests who have voted on a category, read again whenever
 * `version` changes (the category data was read again). Only the host gets
 * any. A failed read keeps the last list.
 */
export function useAwardVoters(
  categoryId: string | undefined,
  version: number,
): string[] {
  const state = useLoad(
    categoryId ?? "",
    () => listAwardVoters(categoryId ?? ""),
    { enabled: !!categoryId, refresh: version, keepOnError: true },
  );
  return state.status === "ready" ? state.value : [];
}
