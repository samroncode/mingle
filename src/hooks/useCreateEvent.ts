import { useState } from "react";
import { createEvent } from "@/api/host-actions";
import { ensureAnonymousSession } from "@/api/session";
import type { CreateEventResponse } from "@/lib/schemas/host-actions";
import type { CreateError } from "@/lib/wizard/create-error";
import { toCreateInput, type WizardDraft } from "@/lib/wizard/state";

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

  async function create(draft: WizardDraft) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const session = await ensureAnonymousSession();
    if (!session.ok) {
      setError(
        session.error === "captcha_failed" ? "captcha_failed" : "network_error",
      );
      setBusy(false);
      return;
    }
    const result = await createEvent(toCreateInput(draft));
    setBusy(false);
    if (result.ok) onCreated(result.data);
    else setError(result.error);
  }

  return { busy, error, create };
}
