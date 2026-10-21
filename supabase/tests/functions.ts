// Calling the Edge Functions over HTTP, the way the browser does. They are
// served for the db tests by functions-setup.ts.
import { execFileSync } from "node:child_process";
import { localStack, type User } from "./helpers";

/** The one origin in the test's ALLOWED_ORIGINS (see functions-setup.ts). */
export const allowedOrigin = "http://localhost:5173";

export function functionUrl(name: string): string {
  return `${localStack().API_URL}/functions/v1/${name}`;
}

export type FunctionResponse = {
  status: number;
  body: unknown;
  text: string;
};

export type CallOptions = {
  /** The caller's session, or none for a browser that never signed in. */
  user?: User;
  /** Sent as `Authorization: Bearer …` in place of the user's session. */
  bearer?: string;
  origin?: string | null;
  /** Sent as-is in place of JSON-encoding the body. */
  rawBody?: string;
};

/** The access token of a user's current session. */
export async function accessToken(user: User): Promise<string> {
  const { data } = await user.client.auth.getSession();
  if (!data.session) throw new Error("no session");
  return data.session.access_token;
}

/** POSTs to host-actions with the headers supabase-js sends. */
export async function callHostActions(
  body: unknown,
  options: CallOptions = {},
): Promise<FunctionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: localStack().ANON_KEY,
  };
  const origin = options.origin === undefined ? allowedOrigin : options.origin;
  if (origin !== null) headers.Origin = origin;
  const bearer =
    options.bearer ??
    (options.user ? await accessToken(options.user) : undefined);
  if (bearer !== undefined) headers.Authorization = `Bearer ${bearer}`;

  const response = await fetch(functionUrl("host-actions"), {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  return { status: response.status, body: parsed, text };
}

/**
 * Sends a CORS preflight straight to the edge runtime, from inside the Docker
 * network. The local gateway answers every preflight itself with `*`; the
 * hosted gateway passes them to the function, so this is what a browser on
 * another site gets in production. Returns the status and the lower-cased
 * response headers.
 */
export function preflight(origin: string): {
  status: number;
  headers: Record<string, string>;
} {
  const output = execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_mingle",
      "curl",
      "-s",
      "-i",
      "-X",
      "OPTIONS",
      "-H",
      `Origin: ${origin}`,
      "-H",
      "Access-Control-Request-Method: POST",
      "-H",
      "Access-Control-Request-Headers: authorization, content-type",
      "http://supabase_edge_runtime_mingle:8081/host-actions",
    ],
    { encoding: "utf8" },
  );
  const [statusLine = "", ...lines] = output.split("\r\n");
  const headers: Record<string, string> = {};
  for (const line of lines) {
    if (line === "") break;
    const colon = line.indexOf(":");
    headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
  }
  return { status: Number(statusLine.split(" ")[1]), headers };
}
