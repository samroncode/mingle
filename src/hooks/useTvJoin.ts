import { useEffect, useState } from "react";
import { joinAsTv } from "@/api/events";
import { ensureAnonymousSession } from "@/api/session";
import type { JoinErrorCode } from "@/api/errors";

export type TvJoinState =
  | { status: "joining" }
  | { status: "joined"; eventId: string }
  | { status: "error"; error: JoinErrorCode | "captcha_failed" };

/**
 * Signs in anonymously if needed and joins the event with this code as its
 * TV. `retry` runs the sign-in again, for a failed CAPTCHA.
 */
export function useTvJoin(code: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ id: string; state: TvJoinState }>();
  const id = code ? `${code}:${attempt}` : undefined;

  useEffect(() => {
    if (!code || !id) return;
    let cancelled = false;
    async function join(target: string): Promise<TvJoinState> {
      const session = await ensureAnonymousSession();
      if (!session.ok) {
        return {
          status: "error",
          error:
            session.error === "captcha_failed" ? "captcha_failed" : "unknown",
        };
      }
      const joined = await joinAsTv(target);
      return joined.ok
        ? { status: "joined", eventId: joined.value }
        : { status: "error", error: joined.error };
    }
    void join(code).then((state) => {
      if (!cancelled) setResult({ id, state });
    });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  const state: TvJoinState = !code
    ? { status: "error", error: "not_found" }
    : result && result.id === id
      ? result.state
      : { status: "joining" };
  return { state, retry: () => setAttempt((previous) => previous + 1) };
}
