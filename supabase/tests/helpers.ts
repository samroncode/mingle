// Shared setup for the `*.db.test.ts` files. They run against the local
// Supabase stack (`npm run db:start`) and act as real users through the same
// client the app uses. The service role is only for seeding and for moving an
// event's clock or status; results are always checked as a client role.
import { execFileSync, execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/api/database.types";

export type Client = SupabaseClient<Database>;
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];
export type EventInsert = Partial<
  Database["public"]["Tables"]["events"]["Insert"]
>;
/** The roles the members table allows (`text` with a check, so not in the generated types). */
export type Role = "host" | "guest" | "tv";

type LocalStack = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

let stack: LocalStack | undefined;

/** URL and keys of the running local stack, read once from the CLI. */
export function localStack(): LocalStack {
  if (!stack) {
    const output = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    stack = JSON.parse(output) as LocalStack;
  }
  return stack;
}

function newClient(key: string): Client {
  return createClient<Database>(localStack().API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client with no session, as a browser that never signed in. */
export function signedOutClient(): Client {
  return newClient(localStack().ANON_KEY);
}

/** Bypasses RLS. Only for seeding and moving an event's clock or status. */
export function serviceClient(): Client {
  return newClient(localStack().SERVICE_ROLE_KEY);
}

export type User = { client: Client; id: string };

/** A fresh anonymous user, signed in the way every browser in Mingle is. */
export async function anonymousUser(): Promise<User> {
  const client = signedOutClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("no user");
  return { client, id: data.user.id };
}

type Users<N extends number, Acc extends User[] = []> = Acc["length"] extends N
  ? Acc
  : Users<N, [...Acc, User]>;

/** Several fresh anonymous users at once. */
export async function anonymousUsers<N extends number>(
  count: N,
): Promise<Users<N>> {
  const users = await Promise.all(
    Array.from({ length: count }, () => anonymousUser()),
  );
  return users as Users<N>;
}

const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random event code in the format the database accepts. */
export function randomCode(): string {
  return Array.from(
    { length: 6 },
    () => codeAlphabet[randomInt(codeAlphabet.length)],
  ).join("");
}

/** Inserts an event with the service role, as host-actions will in spec 2. */
export async function seedEvent(fields: EventInsert = {}): Promise<EventRow> {
  const { data, error } = await serviceClient()
    .from("events")
    .insert({ code: randomCode(), niche: "aw", language: "sv", ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Inserts a member row with the service role. */
export async function seedMember(
  eventId: string,
  userId: string,
  role: Role,
  displayName: string | null = null,
): Promise<void> {
  const { error } = await serviceClient().from("members").insert({
    event_id: eventId,
    user_id: userId,
    role,
    display_name: displayName,
  });
  if (error) throw error;
}

/** Moves an event's expiry into the past. */
export async function expireEvent(eventId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("events")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

/** Sets an event's status, as host-actions will in spec 2. */
export async function setEventStatus(
  eventId: string,
  status: EventRow["status"],
): Promise<void> {
  const { error } = await serviceClient()
    .from("events")
    .update({ status })
    .eq("id", eventId);
  if (error) throw error;
}

/**
 * Runs SQL as the database owner and returns the output rows, one string per
 * row with columns separated by `|`. Only for reading the catalog and for
 * server-only data in `private`, which no API role can reach.
 */
export function sql(query: string): string[] {
  const output = execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_mingle",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tAX",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  );
  return output.split("\n").filter((line) => line !== "");
}

/** A full cast for one event: every role the test matrix covers. */
export type Cast = {
  event: EventRow;
  otherEvent: EventRow;
  host: User;
  guestA: User;
  guestB: User;
  tv: User;
  nonMember: User;
  otherHost: User;
};

/** Seeds an event with a host, two guests and a TV, plus a second event. */
export async function seedCast(fields: EventInsert = {}): Promise<Cast> {
  const [event, otherEvent] = await Promise.all([
    seedEvent(fields),
    seedEvent(),
  ]);
  const [host, guestA, guestB, tv, nonMember, otherHost] =
    await anonymousUsers(6);
  await Promise.all([
    seedMember(event.id, host.id, "host"),
    seedMember(event.id, guestA.id, "guest", "Anna"),
    seedMember(event.id, guestB.id, "guest", "Bertil"),
    seedMember(event.id, tv.id, "tv"),
    seedMember(otherEvent.id, otherHost.id, "host"),
  ]);
  return { event, otherEvent, host, guestA, guestB, tv, nonMember, otherHost };
}
