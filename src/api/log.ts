import { getSupabase } from "./client";
import type { AppClient } from "./session";
import type { CaughtEntry } from "@/lib/logging/catchAll";

/**
 * A failure the app handled and showed. Codes only: no amount, Swish number,
 * guest name, message text or admin key may go in here (docs/logging.md).
 */
export interface HandledError {
  /** The feature, like "costs". */
  area: string;
  /** The step that failed, like "send_bill". */
  action: string;
  /** A short code, like "network_error". */
  code: string;
}

/** The path of a URL without its query or fragment (the host key lives there). */
export function cleanRoute(href: string): string {
  return href.split(/[#?]/, 1)[0] ?? "";
}

function currentRoute(): string | undefined {
  try {
    return cleanRoute(window.location.pathname);
  } catch {
    return undefined;
  }
}

/**
 * Logs one handled error as a `client_errors` row. Never throws and never
 * waits for anyone: a failing log call must not change what the user sees.
 * Only the fixed fields below are sent, whatever the caller passes.
 */
export async function logError(
  entry: HandledError,
  client?: AppClient,
): Promise<void> {
  try {
    await (client ?? getSupabase()).rpc("log_client_error", {
      kind: "handled",
      area: entry.area,
      action: entry.action,
      error_code: entry.code,
      route: currentRoute(),
    });
  } catch {
    // Nothing to do: logging is best effort.
  }
}

/**
 * Logs one caught browser error (uncaught, rejected, render crash, CSP). The
 * entry is cleaned by the caller. Never throws and never waits.
 */
export async function logCaught(
  entry: CaughtEntry,
  client?: AppClient,
): Promise<void> {
  try {
    await (client ?? getSupabase()).rpc("log_client_error", {
      kind: entry.kind,
      area: entry.area,
      action: entry.action,
      error_code: entry.code,
      message: entry.message,
      stack: entry.stack,
      route: currentRoute(),
    });
  } catch {
    // Nothing to do: logging is best effort.
  }
}
