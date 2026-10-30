// The checks every host action passes, in order: CORS, method, body size,
// the caller's JWT and the request schema. Then the action runs, starting with
// its own checks: the rate limit, and for every action but create_event the
// admin key (as-host.ts). Add an action by adding its schema to
// HostActionRequestSchema and a case to `runAction`.
import {
  type HostActionRequest,
  HostActionRequestSchema,
} from "../../../src/lib/schemas/host-actions.ts";
import { authenticate } from "./auth.ts";
import { readJsonBody } from "./body.ts";
import { claimHost } from "./claim-host.ts";
import { corsHeaders } from "./cors.ts";
import { createEvent } from "./create-event.ts";
import type { Db } from "./db.ts";
import { type ActionResult, errorResponse, resultResponse } from "./http.ts";
import { removeGuest } from "./remove-guest.ts";
import { deleteNotice } from "./delete-notice.ts";
import { renameGuest } from "./rename-guest.ts";
import { setBillSent } from "./set-bill-sent.ts";
import { setBrightRoom } from "./set-bright-room.ts";
import { setModules } from "./set-modules.ts";
import { setFlow } from "./set-flow.ts";
import { setPayment } from "./set-payment.ts";
import { updateAwards } from "./update-awards.ts";
import { sendNotice } from "./send-notice.ts";
import { updateCosts } from "./update-costs.ts";
import { updateHotTakes } from "./update-hottakes.ts";
import { updatePartyContent } from "./update-party-content.ts";
import { updateQuiz } from "./update-quiz.ts";

export type HandlerConfig = {
  db: Db;
  allowedOrigins: Set<string>;
};

export function createHandler(config: HandlerConfig) {
  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(
      request.headers.get("Origin"),
      config.allowedOrigins,
    );
    if (cors === null) {
      await request.body?.cancel();
      return errorResponse("origin_not_allowed", { Vary: "Origin" });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      await request.body?.cancel();
      return errorResponse("method_not_allowed", cors);
    }

    const body = await readJsonBody(request);
    if (!body.ok) return errorResponse(body.error, cors);

    const caller = await authenticate(request, config.db);
    if (caller === null) return errorResponse("not_authenticated", cors);

    const parsed = HostActionRequestSchema.safeParse(body.json);
    if (!parsed.success) return errorResponse("invalid_request", cors);

    try {
      return resultResponse(
        await runAction(config.db, caller, parsed.data),
        cors,
      );
    } catch (error) {
      // Only the error's name: messages could echo request data.
      console.error(
        "host-actions failed",
        parsed.data.action,
        error instanceof Error ? error.name : typeof error,
      );
      return errorResponse("internal_error", cors);
    }
  };
}

async function runAction(
  db: Db,
  caller: string,
  request: HostActionRequest,
): Promise<ActionResult> {
  switch (request.action) {
    case "create_event":
      return createEvent(db, caller, request);
    case "claim_host":
      return claimHost(db, caller, request);
    case "set_flow":
      return setFlow(db, caller, request);
    case "update_party_content":
      return updatePartyContent(db, caller, request);
    case "update_quiz":
      return updateQuiz(db, caller, request);
    case "update_awards":
      return updateAwards(db, caller, request);
    case "update_hottakes":
      return updateHotTakes(db, caller, request);
    case "rename_guest":
      return renameGuest(db, caller, request);
    case "remove_guest":
      return removeGuest(db, caller, request);
    case "update_costs":
      return updateCosts(db, caller, request);
    case "set_bill_sent":
      return setBillSent(db, caller, request);
    case "set_payment":
      return setPayment(db, caller, request);
    case "set_modules":
      return setModules(db, caller, request);
    case "set_bright_room":
      return setBrightRoom(db, caller, request);
    case "send_notice":
      return sendNotice(db, caller, request);
    case "delete_notice":
      return deleteNotice(db, caller, request);
  }
}
