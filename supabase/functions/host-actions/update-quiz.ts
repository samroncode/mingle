// update_quiz: the host replaces the quiz questions that aren't played yet,
// between questions or before the quiz starts. The handler has already
// validated them with the shared quiz schema, the same one create_event uses.
// The flow check and the write are one database transaction.
import type {
  UpdateQuizRequest,
  UpdateQuizResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/**
 * Quiz edits per user per event. A host saves the list now and then between
 * questions; this leaves room for a few quick saves in a row.
 */
export const updateQuizRateLimit: RateLimitRule = {
  key: "update_quiz",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal of update_quiz_questions answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  busy: { ok: false, error: "invalid_transition" },
  finished: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  too_many: { ok: false, error: "invalid_request" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function updateQuiz(
  db: Db,
  caller: string,
  request: UpdateQuizRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, updateQuizRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("update_quiz_questions", {
      target_event_id: eventId,
      questions: request.questions,
    });
    if (error) return databaseFailed("update_quiz_questions", error);
    if (outcome !== "updated") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: UpdateQuizResponse = {};
    return { ok: true, body };
  });
}
