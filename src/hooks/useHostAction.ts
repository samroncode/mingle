import type { ParseKeys } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostActionError } from "@/api/host-actions";
import { logError } from "@/api/log";
import { hostPanelErrorKey } from "@/lib/host/host-panel";

/** A finished call: success, or a failure that may carry a host action error. */
type Finished = { ok: true } | { ok: false; error?: HostActionError };

/**
 * Runs a call and turns a throw into a `network_error` result, so the caller
 * always gets an answer back.
 */
export async function settle<R extends Finished>(
  call: () => Promise<R>,
): Promise<R> {
  try {
    return await call();
  } catch {
    return { ok: false, error: "network_error" } as R;
  }
}

/**
 * Runs host actions for the control panel: tracks `busy`, and turns a failed
 * result into a translated `error` line, with `errorKey` choosing the message.
 * Returns the result so the caller can react to success or handle its own
 * failures. With a `logArea` and a `logAction` passed to `run`, a failure is
 * also logged (code only).
 */
export function useHostAction(
  errorKey: (error: HostActionError) => ParseKeys = hostPanelErrorKey,
  logArea?: string,
) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run<R extends Finished>(
    call: () => Promise<R>,
    logAction?: string,
  ): Promise<R> {
    setBusy(true);
    setError(undefined);
    // A throwing call must never leave `busy` set: the buttons would stay locked.
    const result = await settle(call).finally(() => setBusy(false));
    if (!result.ok && result.error) {
      setError(t(errorKey(result.error)));
      if (logArea && logAction)
        void logError({ area: logArea, action: logAction, code: result.error });
    }
    return result;
  }

  return { busy, error, run };
}
