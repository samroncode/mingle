import { useRef, useState } from "react";
import { createEvent } from "@/api/host-actions";
import { ensureAnonymousSession } from "@/api/session";
import type { CreateEventResponse } from "@/lib/schemas/host-actions";
import type { CreateError } from "@/lib/wizard/create-error";
import { toCreateInput, type WizardDraft } from "@/lib/wizard/state";

type CreateOutcome =
  { ok: true; data: CreateEventResponse } | { ok: false; error: CreateError };

/**
 * Signs in if needed and creates the event. Never throws: an unexpected
 * failure is a `network_error`, so the wizard can always show a retry message.
 */
export async function attemptCreate(
  draft: WizardDraft,
  deps = { ensureSession: ensureAnonymousSession, create: createEvent },
): Promise<CreateOutcome> {
  try {
    const session = await deps.ensureSession();
    if (!session.ok) {
      return {
        ok: false,
        error:
          session.error === "captcha_failed"
            ? "captcha_failed"
            : "network_error",
      };
    }
    const result = await deps.create(toCreateInput(draft));
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: result.error };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

/**
 * Creates the event from the wizard draft after making sure this browser has
 * a session. `busy` is true while a call is running, so callers can disable
 * their button; a failure sets `error` and leaves the draft alone.
 */
export function useCreateEvent(
  onCreated: (event: CreateEventResponse) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CreateError | undefined>();
  // A ref, not `busy`: two taps in one tick both see the old state.
  const running = useRef(false);

  async function create(draft: WizardDraft) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await attemptCreate(draft);
      if (result.ok) onCreated(result.data);
      else setError(result.error);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { busy, error, create };
}
