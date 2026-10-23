import type { ParseKeys } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostActionError } from "@/api/host-actions";
import { hostPanelErrorKey } from "@/lib/host/host-panel";

/** A finished call: success, or a failure that may carry a host action error. */
type Finished = { ok: true } | { ok: false; error?: HostActionError };

/**
 * Runs host actions for the control panel: tracks `busy`, and turns a failed
 * result into a translated `error` line, with `errorKey` choosing the message.
 * Returns the result so the caller can react to success or handle its own
 * failures.
 */
export function useHostAction(
  errorKey: (error: HostActionError) => ParseKeys = hostPanelErrorKey,
) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run<R extends Finished>(call: () => Promise<R>): Promise<R> {
    setBusy(true);
    setError(undefined);
    const result = await call();
    setBusy(false);
    if (!result.ok && result.error) {
      setError(t(errorKey(result.error)));
    }
    return result;
  }

  return { busy, error, run };
}
