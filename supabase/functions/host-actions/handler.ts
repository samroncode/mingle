// The checks every host action passes, in order: CORS, method, body size,
// the caller's JWT, the request schema and the action's rate limit. Then the
// action runs. Add an action by adding its schema to HostActionRequestSchema
// and a case to `runAction`.
import {
  type HostActionRequest,
  HostActionRequestSchema,
} from "../../../src/lib/schemas/host-actions.ts";
import { authenticate } from "./auth.ts";
import { readJsonBody } from "./body.ts";
import { claimHost } from "./claim-host.ts";
import { corsHeaders } from "./cors.ts";
import { createEvent, createEventRateLimit } from "./create-event.ts";
import type { Db } from "./db.ts";
import { type ActionResult, errorResponse, resultResponse } from "./http.ts";
import { consumeRateLimit } from "./rate-limit.ts";
import { setFlow } from "./set-flow.ts";

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
    case "create_event": {
      if (!(await consumeRateLimit(db, caller, createEventRateLimit))) {
        return { ok: false, error: "rate_limited" };
      }
      return createEvent(db, caller, request);
    }
    case "claim_host":
      return claimHost(db, caller, request);
    case "set_flow":
      return setFlow(db, caller, request);
  }
}
