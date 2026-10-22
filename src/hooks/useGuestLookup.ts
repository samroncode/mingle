import { useEffect, useState } from "react";
import type { JoinErrorCode } from "@/api/errors";
import { findMyMembership, joinEvent, type MyMembership } from "@/api/events";
import { ensureAnonymousSession } from "@/api/session";

export type Lookup = "loading" | "failed" | MyMembership;

type Found = { code: string; userId: string; value: Lookup };

async function lookUp(code: string): Promise<Found> {
  try {
    const userId = await ensureAnonymousSession();
    const result = await findMyMembership(code, userId);
    return { code, userId, value: result.ok ? result.value : "failed" };
  } catch {
    return { code, userId: "", value: "failed" };
  }
}

/**
 * Makes sure this browser has a session, then finds out whether it is
 * already in the event with this code. `join` joins as a guest and returns
 * the error code on failure; `ended` and `not_found` also end the page's
 * flow through `joinOutcome`.
 */
export function useGuestLookup(code: string) {
  const [found, setFound] = useState<Found>();
  const [outcome, setOutcome] = useState<{
    code: string;
    value: "ended" | "not_found";
  }>();

  useEffect(() => {
    let stale = false;
    void lookUp(code).then((result) => {
      if (!stale) setFound(result);
    });
    return () => {
      stale = true;
    };
  }, [code]);

  async function join(name: string): Promise<JoinErrorCode | undefined> {
    // Results are filed under the code they were asked for, so a slow answer
    // for a code the page has left never shows up on the new one.
    const target = code;
    const result = await joinEvent(target, name);
    if (result.ok) {
      setFound((previous) => ({
        code: target,
        userId: previous?.code === target ? previous.userId : "",
        value: { isMember: true, eventId: result.value, role: "guest" },
      }));
      return undefined;
    }
    if (result.error === "ended" || result.error === "not_found") {
      setOutcome({ code: target, value: result.error });
    }
    return result.error;
  }

  const current = found?.code === code ? found : undefined;
  return {
    lookup: current?.value ?? "loading",
    userId: current?.userId ?? "",
    joinOutcome: outcome?.code === code ? outcome.value : undefined,
    join,
  };
}
