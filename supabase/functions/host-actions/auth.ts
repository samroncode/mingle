// Who is calling: the user id from the caller's own session JWT. The
// publishable or anon key alone is not a session and is refused.
import type { Db } from "./db.ts";

/** The caller's user id, or null when the request has no valid user JWT. */
export async function authenticate(
  request: Request,
  db: Db,
): Promise<string | null> {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match?.[1]) return null;
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user.id;
}
