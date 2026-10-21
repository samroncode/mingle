// set_flow: the host moves the event's flow (start or stop an activity, next
// step, open, reveal, end the event). flow.ts decides whether the move is
// allowed; the write only lands if nothing else moved the event meanwhile.
import {
  type FlowState,
  FlowStateSchema,
  type SetFlowRequest,
  type SetFlowResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { authorizeHost } from "./admin-key.ts";
import type { Db } from "./db.ts";
import { applyMove } from "./flow.ts";
import type { ActionResult } from "./http.ts";
import { consumeEventRateLimit, type RateLimitRule } from "./rate-limit.ts";

/**
 * Flow moves per user per event. A host running a quiz makes a few moves per
 * question; this leaves room for fast clicking but not for a flood.
 */
export const setFlowRateLimit: RateLimitRule = {
  key: "set_flow",
  maxAttempts: 30,
  windowSeconds: 60,
};

export async function setFlow(
  db: Db,
  caller: string,
  request: SetFlowRequest,
): Promise<ActionResult> {
  const auth = await authorizeHost(db, caller, request.code, request.key);
  if (!auth.ok) return auth;
  if (
    !(await consumeEventRateLimit(db, caller, auth.eventId, setFlowRateLimit))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const current = await readFlow(db, auth.eventId);
  if (current === null) return { ok: false, error: "internal_error" };

  const transition = applyMove(
    current.state,
    current.enabledModules,
    request.move,
  );
  if (!transition.ok) return transition;

  const { data: written, error } = await db.rpc(
    "set_event_flow",
    writeArgs(auth.eventId, current.state, transition.state),
  );
  if (error) {
    console.error("set_event_flow failed", error.code);
    return { ok: false, error: "internal_error" };
  }
  // Another move landed after the read, so this one was checked against a
  // state that no longer exists.
  if (!written) return { ok: false, error: "invalid_transition" };

  const body: SetFlowResponse = transition.state;
  return { ok: true, body };
}

/** The event's flow and enabled activities, or null if it can't be read. */
async function readFlow(
  db: Db,
  eventId: string,
): Promise<{ state: FlowState; enabledModules: string[] } | null> {
  const { data, error } = await db
    .from("events")
    .select("status, current_module, current_step, phase, enabled_modules")
    .eq("id", eventId)
    .maybeSingle();
  if (error || data === null) {
    console.error("reading the flow failed", error?.code);
    return null;
  }
  const state = FlowStateSchema.safeParse({
    status: data.status,
    currentModule: data.current_module,
    currentStep: data.current_step,
    phase: data.phase,
  });
  if (!state.success) {
    console.error("the stored flow has an unknown shape");
    return null;
  }
  return { state: state.data, enabledModules: data.enabled_modules };
}

function writeArgs(eventId: string, from: FlowState, to: FlowState) {
  return {
    target_event_id: eventId,
    from_status: from.status,
    from_step: from.currentStep,
    from_phase: from.phase,
    to_status: to.status,
    to_step: to.currentStep,
    to_phase: to.phase,
    // Left out, the database reads null: no activity running.
    from_module: from.currentModule ?? undefined,
    to_module: to.currentModule ?? undefined,
  };
}
