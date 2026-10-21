import { getSupabase } from "./client";
import type { Database } from "./database.types";
import {
  fail,
  ok,
  toJoinErrorCode,
  toRenameErrorCode,
  type JoinErrorCode,
  type RenameErrorCode,
  type Result,
  type SnapshotErrorCode,
} from "./errors";
import type { AppClient } from "./session";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];

/** The event and everyone in it, as one member of the event sees it. */
export type EventSnapshot = { event: EventRow; members: MemberRow[] };

type JoinResult = Database["public"]["CompositeTypes"]["join_result"];

function toJoinResult(
  data: JoinResult | null,
  error: unknown,
): Result<string, JoinErrorCode> {
  if (error || !data) return fail("unknown");
  if (data.event_id && !data.error) return ok(data.event_id);
  return fail(toJoinErrorCode(data.error));
}

/** Joins the event with this code as a guest. */
export async function joinEvent(
  code: string,
  displayName: string,
  client: AppClient = getSupabase(),
): Promise<Result<string, JoinErrorCode>> {
  const { data, error } = await client.rpc("join_event", {
    code,
    display_name: displayName,
  });
  return toJoinResult(data, error);
}

/** Joins the event with this code as its TV. */
export async function joinAsTv(
  code: string,
  client: AppClient = getSupabase(),
): Promise<Result<string, JoinErrorCode>> {
  const { data, error } = await client.rpc("join_tv", { code });
  return toJoinResult(data, error);
}

/**
 * Loads the event and its members in one call. A non-member, an unknown id
 * and an expired event all look the same: `not_found`.
 */
export async function getEventSnapshot(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<EventSnapshot, SnapshotErrorCode>> {
  const { data, error } = await client
    .from("events")
    .select("*, members(*)")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return fail("unknown");
  if (!data) return fail("not_found");
  const { members, ...event } = data;
  return ok({ event, members });
}

/** Changes the signed-in guest's own display name. Returns the cleaned name. */
export async function renameGuest(
  eventId: string,
  displayName: string,
  client: AppClient = getSupabase(),
): Promise<Result<string, RenameErrorCode>> {
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return fail("not_found");

  const { data, error } = await client
    .from("members")
    .update({ display_name: displayName })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .select("display_name");
  if (error) return fail(toRenameErrorCode(error));
  const renamed = data[0]?.display_name;
  return renamed ? ok(renamed) : fail("not_found");
}
