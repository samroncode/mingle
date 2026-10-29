import { fail, ok } from "@/api/errors";
import { findMyMembership } from "@/api/events";
import { ensureAnonymousSession } from "@/api/session";
import { useLoad } from "./useLoad";

/**
 * Finds the id of the event with this code once the host has claimed it.
 * Stays undefined until `enabled`, and while the lookup fails.
 */
export function useHostEventId(code: string | undefined, enabled: boolean) {
  const state = useLoad(
    code ?? "",
    async () => {
      const session = await ensureAnonymousSession();
      if (!session.ok) return fail("session");
      const result = await findMyMembership(code ?? "", session.value);
      if (!result.ok || !result.value.isMember) return fail("not_member");
      return ok(result.value.eventId);
    },
    { enabled: !!code && enabled },
  );
  return state.status === "ready" ? state.value : undefined;
}
