# Supabase in Mingle

How Mingle uses Supabase, and how to run it on the desktop. The rules for writing database code are in "Database rules" in `CLAUDE.md`; the design of the backend is in [`plans/backend-core.md`](plans/backend-core.md).

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
- **The hosted project** on supabase.com is what the real app uses. It changes only when the owner pushes migrations (`supabase db push`) and deploys functions. Agents never do this; `.claude/settings.json` makes those commands always ask.

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

The first ticket of the backend core adds the Supabase CLI and these scripts. They don't exist yet.

| Script | What it does |
|---|---|
| `npm run db:start` | Starts the local stack. The first start downloads several GB of images. |
| `npm run db:stop` | Stops it. |
| `npm run db:reset` | Rebuilds the local database from the migrations. Local data is lost. |
| `npm run db:types` | Regenerates `src/api/database.types.ts` from the local schema. |
| `npm run test:db` | Runs the `*.db.test.ts` tests against the local stack. |

While the stack is running, Supabase Studio at http://localhost:54323 shows the tables, the users and a SQL editor.

## Cloud sessions

Docker itself runs in cloud sessions, but the default network policy blocks the Supabase images. On 2026-10-21 a pull from `public.ecr.aws` was redirected to a CloudFront host that the proxy denied. Broader network access in the environment settings and starting `dockerd` in the setup script might make it work, but that's untested, and the images use several GB of the session's disk. Until that's proven, database tickets are built on the desktop.
