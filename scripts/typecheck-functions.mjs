// Typechecks every Edge Function entry point with `deno check`, using the
// functions' deno.json import map. Needs no Docker. Passes when no functions exist.
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = "supabase/functions";
const entries = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => `${root}/${d.name}/index.ts`)
  .filter((file) => existsSync(file));

if (entries.length === 0) {
  console.log("No Edge Functions to typecheck.");
  process.exit(0);
}

const result = spawnSync(
  "npx",
  ["deno", "check", "--config", `${root}/deno.json`, ...entries],
  { stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
