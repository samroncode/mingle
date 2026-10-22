import { useEffect, useRef, useState } from "react";
import { claimHost } from "@/api/host-actions";
import { ensureAnonymousSession } from "@/api/session";
import type { HostDoorError, HostLinkParts } from "@/lib/host/host-door";

export type ClaimState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: HostDoorError };

async function claim(link: HostLinkParts): Promise<ClaimState> {
  const session = await ensureAnonymousSession();
  if (!session.ok) {
    return {
      status: "error",
      error:
        session.error === "captcha_failed" ? "captcha_failed" : "network_error",
    };
  }
  const result = await claimHost(link);
  return result.ok
    ? { status: "ready" }
    : { status: "error", error: result.error };
}

/**
 * Makes this device a host of the event in the host link. A missing or
 * malformed link fails with `bad_link` without calling the server. `retry`
 * claims again, for errors such as `rate_limited` that may pass.
 */
export function useClaimHost(link: HostLinkParts | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ id: string; state: ClaimState }>();
  // Remembers the claim already sent, so StrictMode's second effect run
  // doesn't send it again.
  const sent = useRef<string | undefined>(undefined);
  const code = link?.code;
  const key = link?.key;
  const id = code && key ? `${code}:${key}:${attempt}` : undefined;

  useEffect(() => {
    if (!code || !key || !id || sent.current === id) return;
    sent.current = id;
    void claim({ code, key }).then((state) => setResult({ id, state }));
  }, [code, key, id]);

  const state: ClaimState =
    id === undefined
      ? { status: "error", error: "bad_link" }
      : result?.id === id
        ? result.state
        : { status: "loading" };

  return { state, retry: () => setAttempt((previous) => previous + 1) };
}
