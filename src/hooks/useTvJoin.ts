import { useEffect, useState } from "react";
import type { JoinErrorCode } from "@/api/errors";
import { joinAsTv } from "@/api/events";
import { trySession } from "@/api/session";

export type TvJoinState =
  | { status: "joining" }
  | { status: "joined"; eventId: string }
  | { status: "error"; error: JoinErrorCode };

/** Signs in anonymously if needed and joins the event with this code as its TV. */
export function useTvJoin(code: string | undefined): TvJoinState {
  const [result, setResult] = useState<{ code: string; state: TvJoinState }>();

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    async function join(target: string): Promise<TvJoinState> {
      if (!(await trySession())) return { status: "error", error: "unknown" };
      const joined = await joinAsTv(target);
      return joined.ok
        ? { status: "joined", eventId: joined.value }
        : { status: "error", error: joined.error };
    }
    void join(code).then((state) => {
      if (!cancelled) setResult({ code, state });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!code) return { status: "error", error: "not_found" };
  return result?.code === code ? result.state : { status: "joining" };
}
