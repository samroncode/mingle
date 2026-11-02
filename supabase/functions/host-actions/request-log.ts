// One structured JSON log line per host-actions request, so the Supabase
// function logs show what happened (docs/logging.md). Codes only: never the
// admin key, the request body, guest names, amounts or Swish numbers.
import { EventCodeSchema } from "../../../src/lib/schemas/host-actions.ts";

/** What one request left behind. Every field is a code or a number. */
export type RequestLog = {
  /** The action name once the body parsed, else null. */
  action: string | null;
  /** The event's short code when the request carried a valid one. */
  event: string | null;
  /** "ok" or the error code the caller got. */
  result: string;
  /** Name of a thrown error (never its message), when there was one. */
  thrown?: string;
  ms: number;
};

export type LogSink = (line: string) => void;

/** Writes the line. Logging must never break a request. */
export function writeRequestLog(entry: RequestLog, sink: LogSink): void {
  try {
    sink(JSON.stringify({ fn: "host-actions", ...entry }));
  } catch {
    // Nothing sensible left to do.
  }
}

/** The event code in a raw body, only if it has the shape of a real code. */
export function eventCodeOf(json: unknown): string | null {
  if (typeof json !== "object" || json === null || !("code" in json)) {
    return null;
  }
  const parsed = EventCodeSchema.safeParse(json.code);
  return parsed.success ? parsed.data : null;
}

/**
 * A failure inside an action, logged as one structured line next to the
 * request line. `what` and `code` are fixed strings or database error codes,
 * never request data.
 */
export function logFailure(what: string, code?: string): void {
  writeRequestFailure({ what, code: code ?? null });
}

function writeRequestFailure(fields: { what: string; code: string | null }) {
  try {
    console.error(
      JSON.stringify({ fn: "host-actions", failure: true, ...fields }),
    );
  } catch {
    // Logging must never break a request.
  }
}
