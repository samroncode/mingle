// Shared by the db tests that call host-actions over HTTP: the host's link,
// the `set_flow` call and the throwaway codes and keys for the negative cases.
import { expect } from "vitest";
import { randomCode, sql, type User } from "./helpers";
import { callHostActions } from "./functions";

/** The secret admin link of an event: its code and key. */
export type HostLink = { code: string; key: string };
export type Move = { type: string; module?: string };

/** A valid-looking key that differs from `key`. */
export function otherKey(key: string): string {
  return (key.startsWith("A") ? "B" : "A") + key.slice(1);
}

/** A code no event has. */
export function unusedCode(): string {
  for (;;) {
    const code = randomCode();
    if (
      sql(`select 1 from public.events where code = '${code}'`).length === 0
    ) {
      return code;
    }
  }
}

/** Sends `set_flow` as the host, or with another event's `link`. */
export function setFlow(
  host: HostLink & { user: User },
  move: Move,
  link: HostLink = host,
) {
  return callHostActions(
    { action: "set_flow", code: link.code, key: link.key, move },
    { user: host.user },
  );
}

/** Makes the moves in order, each of which must be allowed. */
export async function moves(
  host: HostLink & { user: User },
  ...list: Move[]
): Promise<void> {
  for (const move of list) {
    const response = await setFlow(host, move);
    expect(response.status, JSON.stringify(move)).toBe(200);
  }
}
