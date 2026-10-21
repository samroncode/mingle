// Vitest global setup for the db tests: serves this checkout's Edge Functions
// with `supabase functions serve`, so the tests call them over HTTP exactly
// as the browser does. The local stack must already run (`npm run db:start`).
//
// The env file holds the test's own function secrets. It's written to
// supabase/.temp/, which git ignores.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allowedOrigin, functionUrl } from "./functions";

const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = fileURLToPath(
  new URL("../../node_modules/supabase/dist/supabase.js", import.meta.url),
);
const envFile = "supabase/.temp/functions-test.env";
const startTimeoutMs = 180_000;

export default async function setup(): Promise<() => void> {
  mkdirSync(new URL("../.temp", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../.temp/functions-test.env", import.meta.url),
    `ALLOWED_ORIGINS=${allowedOrigin}\n`,
  );

  const serve = spawn(
    process.execPath,
    [cli, "functions", "serve", "--env-file", envFile],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await waitUntilServing(serve);
  } catch (error) {
    stop(serve);
    throw error;
  }
  return () => stop(serve);
}

/** Resolves once the CLI says it's serving and host-actions answers. */
async function waitUntilServing(serve: ChildProcess): Promise<void> {
  let output = "";
  let exited = false;
  serve.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  serve.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  serve.on("exit", () => (exited = true));

  const deadline = Date.now() + startTimeoutMs;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`supabase functions serve exited:\n${output}`);
    }
    if (output.includes("Serving functions on") && (await answers())) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`supabase functions serve did not start:\n${output}`);
}

/** True once host-actions itself (not the gateway) answers a request. */
async function answers(): Promise<boolean> {
  try {
    const response = await fetch(functionUrl("host-actions"), {
      method: "POST",
    });
    const body: unknown = await response.json();
    // The gateway answers `{ message }` while the function isn't up.
    return (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    );
  } catch {
    return false;
  }
}

/** Stops the CLI and what it started. The stack itself keeps running. */
function stop(serve: ChildProcess): void {
  if (serve.exitCode !== null || serve.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(serve.pid), "/T", "/F"]);
  } else {
    serve.kill("SIGINT");
  }
}
