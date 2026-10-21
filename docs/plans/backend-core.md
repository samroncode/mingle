# Plan: Backend core

**Status:** Approved. Step 1 is done (see "Step 1 result"); Steps 2–8 are not built yet.

## Goal

Build the backend that every v1 feature depends on: the database schema and RLS, the `host-actions` Edge Function, the realtime pattern in `src/api/`, and the shared module interface. When this plan is done, an event can be created, joined by guests and a TV, claimed by the host and moved through its flow. Every view can subscribe to the event's state. All of this is proven by tests. There is no UI yet; the create wizard, party screen and modules build on top of this in their own plans.

## Approach

Follows `CLAUDE.md` (principles 1–3, 6, 7 and the data rules), the risks in the Step 1 analysis in [`implementation.md`](../../implementation.md), and [`docs/decisions.md`](../decisions.md). Three decisions were made in chat on 2026-10-20 and are recorded in `docs/decisions.md` in this PR:

- **Open question C is decided:** the host's session is bound to the event (see "Identity and roles").
- **DB tests** run against a local Supabase stack with Vitest.
- **Core schema only.** Each module plan adds its own tables, following the pattern described here.

The guiding rule is the same as in the foundation: **security is enforced by the database, not by the UI.** A guest who opens devtools and calls Supabase directly must not be able to do anything the app wouldn't let them do.

### Identity and roles

Everyone gets an `auth.uid()` from Supabase anonymous sign-in, including the host and the TV. A row in `members` says what that user is in a given event:

| Role | How the row is created | Can read | Can write |
|---|---|---|---|
| `guest` | `join_event(code, display_name)` RPC | Their event, its members, approved module content, their own answers | Their own answers (module tables), their own display name |
| `tv` | `join_tv(code)` RPC | Their event, its members, approved module content, revealed results | Nothing |
| `host` | `host-actions` → `claim_host`, after verifying the admin key | Everything in their event, including drafts and all answers | Nothing directly. Every change goes through `host-actions` |
| non-member | — | Nothing | Nothing (except calling the join RPCs) |

**Why the host is bound (question C):** the host panel needs live data that guests must not see, such as drafts and individual answers before a reveal. Binding the host's session lets RLS and realtime serve that directly, instead of every host read going through a function and refetching. Writes are unchanged from `CLAUDE.md` principle 2: every host action still goes through `host-actions`, which verifies the admin key on every call. A side effect is that a second device opening the host link becomes a co-host, which is the expected behavior for a shared admin link.

**Why the TV is a member:** the TV needs the guest list and approved content, which non-members must not read. Making it a member keeps a single access rule ("members of the event"), at the cost that anyone with the code can register as a TV. That is no more exposure than joining as a guest, since the code is shown on the TV anyway. (Listed under open questions in case you want it stricter.)

### Schema (migration 1)

**`public.events`**
- **Identity:**
  - `id` (uuid).
  - `code`: 6 characters from an alphabet without look-alikes (no `0/O`, `1/I/L`). Unique.
- **Setup:**
  - `niche` (text).
  - `language` (`sv` | `en`).
  - `enabled_modules` (text array).
  - The values are checked against the niche and module registries by Zod in `host-actions`. The database only checks the shape.
- **Party-screen content:** `party` (jsonb) holds welcome text, menu, schedule, wifi details and the music link. It's validated by a shared Zod schema on every write. Everything in it is host-written or host-approved, so members may read it.
- **Flow state** (principle 1):
  - `status` (`lobby` | `live` | `ended`).
  - `current_module` (nullable).
  - `current_step` (int).
  - `phase` (`idle` | `open` | `revealed`).
- **Lifecycle:** `created_at`, `expires_at`.

**`public.members`**
- **Columns:**
  - `event_id`, `user_id` (references `auth.users`), `role`.
  - `display_name`: required for guests and empty for others. It's trimmed and limited to 1–30 characters.
  - `created_at`.
- **Constraints:**
  - Unique per (`event_id`, `user_id`).
  - Guest names are unique per event, ignoring case.
- **Personal data:** none beyond the display name (data rules).

**`private` schema** (not exposed through the Data API, so clients can't reach it at all)
- **`event_secrets`:** `event_id` and `admin_key_hash`.
  - The admin key is 32 random bytes, base64url-encoded, shown to the host once.
  - It's stored as a SHA-256 hash. A slow hash like bcrypt isn't needed because the key is long and random, not a password.
- **`rate_limits`:** counters per user and per action, for `host-actions` and failed join attempts.
- **RLS:** still enabled on these tables, but with no client policies. That is intentional, and the migration says so in a comment. `CLAUDE.md` gets a line that tables in `private` are server-only, so "a table without policies is a bug" isn't misread.

**Helper functions**
- **`is_member(event_id)` and `is_host(event_id)`:**
  - They're `security definer` with a fixed `search_path`, used inside policies.
  - Using them in policies avoids recursive RLS checks on `members`.
- **Expiry:** an expired event (`expires_at < now()`) counts as no membership.
- **Retention:** `expires_at` is set at creation from one constant in the migration. The length is still open (question E). The `cleanup` function is a later plan.

**Realtime:** `events` and `members` are added to the `supabase_realtime` publication. Module tables add themselves in their own migrations.

### RLS rules

- **`events`:** members can `select`. There is **no** client `insert`, `update` or `delete`. Creation and every flow change happen in `host-actions` with the service role.
- **`members`:**
  - Members of the same event can `select` each other.
  - A guest can `update` only their own `display_name`. Role and event can't change; a column-level grant enforces this.
  - There is no client `insert` (the join RPCs do it) and no client `delete`.
- **Non-members** get nothing back, not even whether a code exists.

**Pattern for module tables** (each module plan follows it, and the RLS tests are copied with it):
- **Content** (questions, award categories, hot takes):
  - `status` is `draft` | `approved`.
  - Guests and the TV can only `select` approved rows. The host sees all.
  - Clients never write content. AI drafts and host edits go through functions.
- **Answers and votes:**
  - A guest can `insert` and `update` their own row, while the step is `open` and only for the current step. This is checked against `events` in the policy.
  - A guest can `select` only their own rows. The host can `select` all rows.
- **Results:**
  - A `security definer` function returns aggregates only when `phase = 'revealed'` for that step. This is how the TV and guests see results.
  - Individual answers never reach other guests.

### Join RPCs

- **`join_event(code, display_name)` and `join_tv(code)`:**
  - Both are `security definer` with a fixed `search_path`, and called through `src/api/`.
  - They find the event by code and refuse `ended` or expired events.
  - They insert the member row for `auth.uid()` and return the event id. Calling again is idempotent.
  - `join_event` trims and validates the name and returns `name_taken` on a clash.
- **Throttling against code guessing:**
  - Failed lookups are counted per user in `private.rate_limits`. After a small limit (for example 10 a minute), the RPC refuses.
  - Supabase also rate-limits anonymous sign-ins per IP, which limits how many fresh users an attacker can create.
- **Errors** are codes (`not_found`, `ended`, `name_taken`, `rate_limited`, `invalid_name`). The UI maps them to i18n keys (principle 7).

### `host-actions` Edge Function

`supabase/functions/host-actions/` is one endpoint. The body is a Zod discriminated union on `action`.

| Action | Needs admin key | What it does |
|---|---|---|
| `create_event` | No (it creates one) | Validates the wizard data, generates the code and admin key, stores the hash, inserts the host as a member, and returns `{ code, key }`. **This is the only time the key is ever returned.** |
| `claim_host` | Yes | Adds the caller's session as `host` of the event (idempotent). Used when the host link is opened on a new device or after the session is lost. |
| `update_party_content` | Yes | Replaces `events.party` after Zod validation. |
| `set_flow` | Yes | `start_module`, `stop_module`, `next_step`, `open`, `reveal` and `end_event`. It checks that the module is enabled and the transition is valid. |

How it works:
- **Auth:**
  - It requires a valid user JWT (the caller's anonymous session). That is how it knows which `auth.uid()` to bind in `claim_host` and `create_event`.
  - The database is written with the service-role client inside the function. The service-role key comes from the function environment and never reaches the browser.
- **Key check:**
  - The function hashes the key it receives and compares it to `private.event_secrets` in constant time.
  - A wrong key and an unknown code return the **same** error (`not_authorized`), so the function can't be used to probe for codes.
  - The key is never logged.
- **Limits:**
  - Per user and per event, through `private.rate_limits`, for example a few `create_event` per user per hour.
  - Request bodies are size-capped.
- **CORS:** only origins listed in the `ALLOWED_ORIGINS` function secret are allowed: localhost for dev, and the Vercel domains.
- **Errors:** responses carry an error code, never free text, for the same i18n reason as the RPCs.
- **Extensibility:** module plans add their actions (approve or delete drafts and so on) to the union, in their own files under the function.

### Shared Zod schemas

Request bodies, `events.party` and module content are validated in **both** the app (forms) and the function (trust boundary). One copy prevents drift (risk 7).

- **Default:** schemas live in `src/lib/schemas/`, written as plain Zod with no browser or Node imports. The function imports them by relative path, and `zod` in the function resolves through `npm:` in its `deno.json`.
- **Spike in Step 1:** prove that `supabase functions serve` and `deploy` bundle a file outside `supabase/functions/`.
- **Fallback:** if they don't, the schemas move to `supabase/functions/_shared/schemas/`, and the app imports them through an `@shared` alias.

### `src/api/` and hooks

- **`auth.ts`:** `ensureAnonymousSession()` signs in anonymously once and reuses the stored session.
- **`events.ts`:**
  - `joinEvent()`, `joinAsTv()`.
  - `getEventSnapshot(eventId)`, which returns the event and its members in one call.
- **`host.ts`:**
  - A typed wrapper around `functions.invoke("host-actions")`. Input and output types come from the shared schemas.
  - It maps error codes to a typed result.
- **`realtime.ts`:** `subscribeToEvent(eventId, onChange)` (risk 4).
  - It subscribes to `postgres_changes` on `events` and `members`, filtered to the event.
  - Changes are only used as an **invalidation signal**. The client always refetches the snapshot instead of patching state from the payload. That way RLS applies the same way to every read, and missed messages don't matter.
  - When the subscription is confirmed, it fetches the snapshot, so nothing that happened between the fetch and the subscription is lost.
  - On a channel error, timeout or close, it resubscribes with backoff and refetches.
  - When the tab becomes visible again (a TV waking from sleep), it refetches.
  - It returns an unsubscribe function.
- **`src/hooks/useEventState.ts`:** wraps the above for the views and exposes `{ status, event, members, error }`.
- **`src/lib/adminKey.ts`:** `readAdminKey(hash)` parses `#key=…` from the URL fragment. It's a pure function with unit tests; the views use it later.

Supabase broadcast-from-database is the scalable alternative to `postgres_changes`. It isn't needed at party size (tens of clients). It's noted here in case it's ever needed.

### Module interface

`src/modules/types.ts` defines `ModuleDefinition`:
- `id: ModuleId` and `nameKey` (i18n).
- `HostPanel`, `TvView` and `GuestView` components, with shared props (the event snapshot, the current step).
- `contentSchema` (Zod).

Only the type is added here. `registry.ts` keeps its ids until the first module plan registers an implementation.

### Tooling

| Addition | Type | Why |
|---|---|---|
| `supabase` (CLI) | dev, **new dependency, needs approval** | Local stack in Docker, migrations, `gen types`, `functions serve`. It was deliberately left out of the foundation until a feature needed it. |

- **`supabase/config.toml`:** created by `supabase init` and committed. Anonymous sign-ins are on, and API schemas are `public` only, so `private` isn't exposed.
- **Scripts:**
  - `db:start` / `db:stop`: run `supabase start` / `supabase stop`.
  - `db:reset`: re-applies the migrations to the local stack.
  - `db:types`: generates `src/api/database.types.ts` from the local schema. It replaces the placeholder (risk 11).
  - `test:db`: runs Vitest on `**/*.db.test.ts` against the local stack.
- **Test split:** `npm run test` stays fast and needs no Docker, so the db tests are excluded there.
- **Function code:** the function code under `supabase/functions/` is Deno.
  - It gets its own `deno.json`.
  - It's excluded from the app's `tsconfig`, and linted with a separate ESLint block that doesn't use the browser globals.
  - ~~Its typecheck happens when it's served.~~ Step 1 showed it doesn't: see "Step 1 result" and the open question on typechecking.
- **`.env.example`:** gets a commented section listing the function secrets (`ALLOWED_ORIGINS`). It also notes that the Supabase URL and service-role key are injected by the platform and must never get a `VITE_` prefix.

## Steps

Each step ends with: checks pass → commit → push → wait for the owner's go-ahead.

**Standard check:** `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`. From Step 2 on, also `npm run test:db` (desktop only, needs Docker).

1. **Tooling and spike.**
   - Install the CLI and run `supabase init`. Set up the config and the scripts.
   - Spike: a throwaway function imports a schema from `src/lib/schemas/`, and is served and called locally.
   - Set up the ESLint and tsconfig split for function code.
   - *Verify:* `db:start` brings up the stack, the spike function answers, and the standard check passes. The spike is removed before the commit. Its result, and the fallback if it was needed, are recorded in this plan.
   - **Step 1 result (2026-10-21):**
     - **The default works for `serve`.** A throwaway function imported a Zod schema from `src/lib/schemas/` by relative path (`../../../src/lib/schemas/…ts`). `supabase functions serve` (edge runtime 1.77.4, Deno 2.1.4) bundled it and answered 200 for a valid body and 400 for an invalid one. The fallback (`_shared/` with an `@shared` alias) is **not** needed.
     - **One import map for all functions:** `supabase/functions/deno.json` maps `zod` to `npm:zod`. It is what resolves the bare `zod` import inside `src/lib/schemas/` too. With a bogus mapping the worker failed to boot, and without the file it failed with `Relative import path "zod" not prefixed…`. So the app (`node_modules`) and the functions (`npm:`) each resolve their own copy; keep the version ranges in `package.json` and `deno.json` in step.
     - **`deploy` is not verified.** It needs a linked project (owner to-do). Verify it in Step 5 when `host-actions` is first deployed; if bundling fails there, switch to the fallback.
     - **`serve` does not typecheck.** A deliberate type error in the function still served 200. The edge runtime only strips types, and the app's `tsc -b` doesn't cover `supabase/functions/`. Today the function code is only linted. See the open question on typechecking.
     - **Other notes:** `config.toml` sets `project_id = "mingle"` (otherwise it defaults to the folder name, which differs per worktree), and the local auth `site_url` is the Vite dev server (`http://localhost:5173`). `db:types` runs Prettier on the generated file so `format:check` stays green. `test:db` passes with no test files until Step 3 adds them.
2. **Migration 1: schema, helpers, publication.**
   - Create `supabase/migrations/<timestamp>_core.sql` and run `db:types`.
   - *Verify:* `db:reset` applies it cleanly, and the generated types compile. Every table in `public` has RLS on (a SQL check in the test suite).
3. **RLS test matrix.**
   - Write `*.db.test.ts` with real anonymous sessions as non-member, guest A, guest B, TV, host, and the host of another event.
   - Each is tested against `select`, `insert`, `update` and `delete` on `events` and `members`, and against reading `private`.
   - *Verify:* all green. Demo: drop one policy and a test fails.
4. **Join RPCs.**
   - Add `join_event` and `join_tv` with throttling, plus tests.
   - The tests cover a bad code, an ended event, a taken name, idempotent rejoin and the rate limit.
5. **`host-actions`.**
   - Write the shared request schemas and the four actions, with integration tests through `supabase functions serve`.
   - The tests cover a wrong key, a key for another event, an unknown code (same error as a wrong key), an invalid transition, a disabled module, an oversized body and CORS.
6. **`src/api/`, hooks and `adminKey`.**
   - Unit tests cover the pure parts (`adminKey`, error mapping).
   - Realtime is tested against the local stack: a host action is seen by a subscribed guest client, and after a forced disconnect the client catches up through refetch.
7. **Module interface.** Add `src/modules/types.ts`, typed and documented. No implementations.
8. **Docs.**
   - `docs/decisions.md` for anything decided during the build.
   - `CLAUDE.md`: folder structure for `src/lib/schemas/`, server-only `private` tables, and where the db tests live.
   - `README.md` and `docs/workflow.md`: Docker for `test:db`, and the fact that cloud sessions run only `npm run test`.
   - The owner's to-dos below.

## Verification

- The standard check, plus `npm run test:db` on the desktop.
- Demos, as in the foundation:
  - remove one RLS policy and watch a test fail
  - a guest calling `update events` directly is denied
  - a wrong admin key is rejected with the same error as an unknown code
  - a guest reading another guest's answers is denied (once the first module table exists, the pattern test covers it)
- A realtime reconnect demo in the browser pane, using a small test page that is removed afterwards.

## Owner to-dos

These are outside the repo, so the agent can't do them:
- **Supabase project:**
  - Create the project.
  - Run `supabase link`, then `supabase db push` for the migration.
  - Enable anonymous sign-ins in the dashboard.
  - Consider turning on CAPTCHA for anonymous sign-ins before a public launch (see open questions).
- **Function:**
  - Set the function secret `ALLOWED_ORIGINS`.
  - Deploy with `supabase functions deploy host-actions`.
- **Environment:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the cloud environment and Vercel, if that isn't already done.

## Not in this plan

- `ai-suggest`. It gets its own plan, after the first module defines its content schema.
- `cleanup`, including deleting anonymous `auth.users` rows for expired events (risk 10).
- Module tables, any UI (wizard, party screen, host panel), and the QR library.
- Playwright and CI.

## Open questions

- **E:** How long is event data kept? The schema uses one constant until this is decided.
- **CAPTCHA on anonymous sign-in:** Supabase recommends it against abuse. It would mean a third-party widget (hCaptcha or Turnstile) on the join and create pages. Should it come before a public launch?
- **Typechecking function code (from Step 1):** nothing typechecks `supabase/functions/` today. Options: (a) add the `deno` npm package as a dev dependency and a `typecheck:functions` script running `deno check` (new dependency, needs approval); (b) rely on lint plus the Step 5 integration tests; (c) also typecheck the functions with `tsc`, which doesn't understand `npm:` specifiers or `Deno` types without extra setup. Recommendation: (a), decided before Step 5.
- **TV as a member:** the plan lets anyone with the code register as a TV, which is no more than a guest can see. A stricter option is a separate TV token shown only in the host panel. Is the simpler model acceptable?
