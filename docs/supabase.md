# Supabase in Mingle

How Mingle uses Supabase, and how to run it on the desktop. The rules for writing database code are in "Database rules" in `CLAUDE.md`; the design of the backend is in [`plans/backend-core.md`](archive/plans/backend-core.md).

## The parts Mingle uses

Supabase is a Postgres database with services around it. Mingle uses five of them:

| Part | What it does in Mingle |
|---|---|
| **Postgres** | Stores events, members, questions, answers and votes. |
| **Row Level Security (RLS)** | Rules inside the database that decide which rows each user may read or write. This is what stops a guest from reading another guest's answers, even from devtools. |
| **Auth, anonymous sign-in** | Gives every browser (host, guest, TV) a user id, `auth.uid()`, without an account. RLS rules are written against that id. |
| **Realtime** | Tells the TV and the phones when rows change, so every screen updates live. |
| **Edge Functions** | Small server programs (Deno) for what the browser must never do itself: checking the admin key in `host-actions`, and, when AI is enabled, calling the AI provider in `ai-suggest`. |

The browser talks to Supabase with the publishable key, which is public by design. Everything the browser may do is decided by RLS. The service-role key skips RLS, so it only exists inside the Edge Functions.

## Local stack and hosted project

There are two copies of the backend:

- **The local stack** runs the same Supabase services in Docker on the desktop. It's for development and for `npm run test:db`. It's disposable: `npm run db:reset` wipes it and rebuilds it from the migrations.
- **The hosted project** on supabase.com is what the real app uses. It changes only through the **Deploy** workflow, which runs migrations and function deploys after the owner merges to `main` (see [`hosting.md`](hosting.md)). A second **staging** project backs PR previews. Agents never push migrations or deploy functions by hand; `.claude/settings.json` makes those commands always ask.

**Migrations** connect the two. They're SQL files in `supabase/migrations/`, committed to git, that build the schema the same way in both places.

## Setting up Docker on the desktop (Windows)

The local stack needs Docker Desktop. If an older install doesn't work, start over:

1. **Remove the old version:** Settings → Apps → Docker Desktop → Uninstall.
2. **Check Windows:** run `winver`. You need Windows 10 22H2 or Windows 11 23H2 or later.
3. **Check virtualization:** Task Manager → Performance → CPU should say "Virtualization: Enabled". If it doesn't, turn on Intel VT-x or AMD SVM in the BIOS/UEFI settings.
4. **Update WSL:** in PowerShell as administrator, run `wsl --install` (if WSL is missing), then `wsl --update`. `wsl --version` must show 2.1.5 or later. Restart the computer.
5. **Install Docker Desktop:** download the latest version from docker.com and keep "Use WSL 2" ticked. Start it and wait until it says the engine is running.
6. **Test it:** `docker run --rm hello-world` should print "Hello from Docker!".

Common problems:

| Message | Fix |
|---|---|
| WSL is out of date or the installation is incomplete | Step 4, then restart. |
| Virtualization support not detected | Step 3. |
| Docker Desktop stays on "Starting" | Run `wsl --shutdown` in PowerShell, then start Docker Desktop again. |
| Containers crash or `supabase start` hangs | Give WSL more memory: create `%UserProfile%\.wslconfig` with `[wsl2]` on one line and `memory=8GB` on the next, then run `wsl --shutdown`. |
| Port 54321 is already in use | Another local Supabase stack is running. Stop it with `npx supabase stop` in that folder, or restart Docker Desktop. |

## Commands

| Script | What it does |
|---|---|
| `npm run db:start` | Starts the local stack. The first start downloads several GB of images. |
| `npm run db:stop` | Stops it. |
| `npm run db:reset` | Rebuilds the local database from the migrations. Local data is lost. |
| `npm run db:types` | Regenerates `src/api/database.types.ts` from the local schema. |
| `npm run test:db` | Runs the `*.db.test.ts` tests against the local stack. It first serves this checkout's Edge Functions with `supabase functions serve`, so the `host-actions` tests call them over HTTP. |

While the stack is running, Supabase Studio at http://localhost:54323 shows the tables, the users and a SQL editor.

## Nightly cleanup

Expired events and everything in them are deleted by `private.cleanup_expired()`, which `pg_cron` runs every night at 03:00 UTC under the job name `cleanup-expired-events`. It also deletes old rate-limit counters and anonymous logins that belong to no event and have been unused for 30 days. No client role can run it. The rules are in `decisions.md` (2026-10-22, cleanup of expired events).

**Check the run history.** In the Supabase dashboard, open the SQL editor and run:

```sql
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'cleanup-expired-events')
order by start_time desc
limit 10;
```

`return_message` is the first row of the result, and `status` is `succeeded` or `failed`. The counts (`events`, `codes_retired`, `rate_limits`, `users`) are in the function's return value; to see them for a run, run it by hand as below.

**Run it by hand.** Only an admin can, in the dashboard's SQL editor:

```sql
select private.cleanup_expired();
```

It returns the counts as JSON. This deletes data for good, with no undo, so only run it when you mean it. Running it twice in a row is safe; the second run returns zeros.

## Cloud sessions

Database tests can run in a cloud session. Start Docker with `sudo dockerd &`, then `npm run db:start`, then `npm run test:db` (see `decisions.md`, 2026-10-22). The first start downloads several GB of images, which use part of the session's disk.

The Edge Function tests still fail there, because the local function runtime can't fetch npm packages through the cloud proxy. Changes to `supabase/functions/` (including `host-actions`) are built and tested on the desktop.
