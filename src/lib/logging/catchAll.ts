import {
  cleanMessage,
  cleanStack,
  describeThrown,
  hostOf,
  type CaughtError,
} from "./sanitize";

export type CaughtKind = "error" | "rejection" | "render" | "handled";

/** One row to send. Every text is already cleaned. */
export interface CaughtEntry {
  kind: CaughtKind;
  area: string;
  action: string;
  code: string;
  message?: string;
  stack?: string;
}

export type CaughtSink = (entry: CaughtEntry) => void;

const MAX_PER_SIGNATURE = 3;
const MAX_PER_PAGE = 20;

/** Decides whether an entry may be sent: a few per kind of error, a cap per page load. */
export function createLimiter() {
  const seen = new Map<string, number>();
  let total = 0;
  return (entry: CaughtEntry): boolean => {
    if (total >= MAX_PER_PAGE) return false;
    const signature = `${entry.kind}|${entry.code}|${entry.message ?? ""}`;
    const count = seen.get(signature) ?? 0;
    if (count >= MAX_PER_SIGNATURE) return false;
    seen.set(signature, count + 1);
    total += 1;
    return true;
  };
}

/** Builds a cleaned entry for a thrown or rejected value. */
export function entryFromThrown(
  kind: "error" | "rejection" | "render",
  action: string,
  thrown: unknown,
): CaughtEntry {
  const caught: CaughtError = describeThrown(thrown);
  return {
    kind,
    area: "app",
    action,
    code: caught.name.slice(0, 60),
    message: cleanMessage(caught.message),
    stack: caught.stack ? cleanStack(caught.stack) : undefined,
  };
}

/** Logs what the router error screen caught. Never throws. */
export function reportRenderCrash(error: unknown, sink: CaughtSink): void {
  try {
    sink(entryFromThrown("render", "error_view", error));
  } catch {
    // Logging must never change what the user sees.
  }
}

/** Builds the entry for a Content-Security-Policy violation: directive and host only. */
export function entryFromCsp(event: SecurityPolicyViolationEvent): CaughtEntry {
  return {
    kind: "handled",
    area: "csp",
    action: "csp_violation",
    code: (
      event.effectiveDirective ||
      event.violatedDirective ||
      "unknown"
    ).slice(0, 60),
    message: hostOf(event.blockedURI),
  };
}

/**
 * Listens for uncaught errors, unhandled rejections and CSP violations once.
 * Never throws: whatever goes wrong inside is swallowed so rendering goes on.
 * Returns a function that removes the listeners.
 */
export function installCatchAll(
  sink: CaughtSink,
  target: Window = window,
): () => void {
  const allow = createLimiter();
  const send = (build: () => CaughtEntry) => {
    try {
      const entry = build();
      if (allow(entry)) sink(entry);
    } catch {
      // Logging is best effort.
    }
  };
  const onError = (event: ErrorEvent) =>
    send(() =>
      entryFromThrown("error", "uncaught", event.error ?? event.message),
    );
  const onRejection = (event: PromiseRejectionEvent) =>
    send(() =>
      entryFromThrown("rejection", "unhandled_rejection", event.reason),
    );
  const onCsp = (event: Event) =>
    send(() => entryFromCsp(event as SecurityPolicyViolationEvent));

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("securitypolicyviolation", onCsp);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("securitypolicyviolation", onCsp);
  };
}
