import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

export { deleteNotice, sendNotice } from "./host-actions";

/** A notice the host sent, as a member reads it. */
export interface NoticeView {
  id: string;
  /** Plain text, 1 to 140 characters, in the event's language. */
  text: string;
  /** ISO time it was sent. */
  createdAt: string;
}

/**
 * The event's notices, newest first. Any current member of the event reads
 * them; a removed guest and a non-member get an empty list.
 */
export async function listNotices(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<NoticeView[], "unknown">> {
  const { data, error } = await client
    .from("notices")
    .select("id, text, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
    })),
  );
}
