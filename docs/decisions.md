# Decisions

Product and architecture decisions, newest first. Add an entry in the same PR whenever a decision is made, in a chat or on a PR, so that later sessions on any device know about it. `CLAUDE.md` holds the standing rules; this file records when and why they were set.

Entry format:

```markdown
## YYYY-MM-DD: Short title

**Decision:** What was decided.

**Why:** The reason, and any alternatives that were rejected.
```

## 2026-10-21: Loose docs live in docs/, tool config stays at the root

**Decision:**
- `GLOSSARY.md`, `IDEAS.md` and `implementation.md` moved from the repo root into `docs/`. The copied skills in `.claude/skills/` point at `docs/GLOSSARY.md`.
- The empty Prettier config moved from `.prettierrc.json` into a `"prettier": {}` key in `package.json`.
- Everything else at the root stays, because the tools look for it there: `package.json` and the lockfile, the `tsconfig` files, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `vercel.json`, `components.json` (shadcn), the dotfiles, `README.md` and `CLAUDE.md`.
- New docs go in `docs/`, not the root.

**Why:** The root was hard to scan on GitHub. Moving tool config into a subfolder would need custom paths in several tools and break their defaults, so only docs and the empty config were moved. The Prettier key is kept, rather than deleted, so an editor's own Prettier settings can't override the project's defaults.

## 2026-10-21: Details settled while building the setup wizard (#29)

**Decision:**
- Skip on the welcome step puts back the niche's ready welcome text. Skip on the other steps clears what was typed there, so that part is left out of the event.
- The control panel shows the code and TV address, and keeps the host link hidden until the host taps "Show host link". Copy and Share work without showing it. The done screen still shows it in full.
- The wizard's inputs and Add buttons use the party schema's limits, so anything the wizard accepts also survives a reload and passes the server.
- The shadcn components added here (card, input, switch, textarea) were written by hand in the existing style, because the shadcn CLI couldn't reach its registry from the cloud session.

**Why:** A host in a hurry who skips everything should still get a good TV. A host who mirrors their phone or shares the screen shouldn't show the key to the room, since anyone with it can run the evening.

## 2026-10-21: What the setup wizard covers (#29)

**Decision:**
- The setup wizard comes next, after the backend core. The order of the later steps (activities, cleanup, AI) is still open.
- The wizard offers all three niches. Team event and Bachelor/bachelorette get their configs now (name, description, placeholder theme, default activities); their activity content comes with each activity.
- The wizard asks for niche, language, activities, welcome text, menu, schedule, wifi and music link, in short phone steps with Back and Next, then a summary and Create. Every step after language can be skipped. It doesn't ask for guest names, a vibe or themes: guests type their own name when they join, and vibe and themes would only steer AI or content picking, so they come back with those plans if needed. Picking quiz questions, award categories and hot takes is added to the wizard by each activity's spec.
- Each niche ships a ready welcome text in Swedish and English, filled in and editable. Menu, schedule, wifi and music start empty.
- The language step starts on the host's current UI language. A host may switch every activity off; the TV then shows only the party screen.
- Unfinished wizard input is kept in this browser and cleared after Create. Nothing reaches the server before Create. A failed create shows a plain message and keeps the input.
- The last screen shows the code, the host link with Copy and Share (the phone's share menu), a warning that the link can't be shown again, the TV address, and a button into the control panel. It shows no QR code; the TV shows the join QR code.
- The browser that created an event remembers its host link. The start page lists these under "Your events", each with a way back into the control panel and a Forget button, and drops them after the event's 30-day expiry. Anyone holding the unlocked device can open the control panel, which was accepted.
- The wizard spec builds only the door into the control panel: opening the host link claims the host role and shows the code, TV address and host link; a wrong or expired link shows an error. Running activities and editing the party screen come with the control panel spec.
- `@playwright/test` is added as a dev dependency. One test clicks through the wizard at phone size with the `host-actions` answer faked, so it runs in cloud sessions without Docker.

**Why:** Every later step needs a way to create an event, and the backend for it already exists, so the wizard is small and safe. Steps keep each screen short on a phone. Asking for things nothing uses yet would only slow the host down. The host link is the only way back into an event, so the wizard makes it hard to lose: a clear warning, Share, and a copy on the device. Faking the server in the browser test keeps it fast and runnable anywhere; `host-actions` itself is already tested over HTTP.

## 2026-10-21: How a live event view handles a failed refetch and a non-member (#23)

**Decision:**
- `subscribeToEvent` in `src/api/realtime.ts` treats every change as a signal to refetch the snapshot. When a refetch fails, the view keeps the last snapshot on screen and sets the error code (`useEventState` goes to `error` with the old `event` and `members`); the next successful refetch makes it `ready` again.
- A subscription by someone who isn't a member of the event only ever gets `not_found`, never event or member data. RLS decides every read, so the realtime channel itself carries nothing the caller couldn't read directly.

**Why:** A TV losing the network for a moment should keep showing the party screen instead of going blank. Answering a non-member with `not_found` matches the join RPCs, so nobody learns more about an event from realtime than from joining it.

## 2026-10-21: How `update_party_content` replaces the party screen (#19)

**Decision:**
- The body is `{ action: "update_party_content", code, key, party }`, where `party` is validated by the same `PartySchema` that `create_event` uses. It replaces `events.party` as a whole: parts the host leaves out are removed. It answers `{}`; members see the new content on their next read.
- An ended event's content can't be changed: it answers `409 invalid_transition`, the same code as any flow move after the end, so "the event is over" has one code for the host. An expired event answers `403 not_authorized` like every other host action, because the admin key check already treats it as unknown.
- The write goes through the service-role-only RPC `update_event_party`, which checks expiry and status in the same statement as the update and answers `updated`, `ended` or `not_found`, so an event that ends or expires between the key check and the write is never changed.
- After the key check, updates are rate-limited per user and event: 10 per minute, counted under `update_party_content:<event id>`.

**Why:** Replacing the whole object keeps the action simple and matches the wizard, which edits all of it at once. Reusing `invalid_transition` avoids a new error code and i18n key for a case the host only reaches after ending the event. Ten saves a minute is plenty for fixing a typo or the wifi password during the evening.

## 2026-10-21: How `set_flow` moves the event's flow (#20)

**Decision:**
- The body is `{ action: "set_flow", code, key, move }`, where `move` is one of `start_module` (with `module`), `stop_module`, `next_step`, `open`, `reveal` and `end_event`. It answers the flow after the move: `{ status, currentModule, currentStep, phase }`.
- Which move is allowed in which state lives in one place, the state machine in `supabase/functions/host-actions/flow.ts`, with the table in its header. An activity can only start when none is running (stop it first). `next_step` is allowed from `idle` (skipping a step) and `revealed`, but not while a step is `open`, so guests' answers are never dropped unseen. `stop_module` leaves the event `live` with no activity: the party screen. `end_event` clears the activity, and after it every move, `end_event` included, answers `invalid_transition`.
- Disallowed moves answer `409 invalid_transition`; starting an activity that isn't in `enabled_modules` answers `409 module_disabled`.
- The write is a compare-and-set: the service-role-only RPC `set_event_flow` changes the event only if it still has the flow the move was checked against, so two simultaneous moves can't both apply. A new constraint, `events_flow_check`, holds the same shape in the database: no activity means step 0 and `idle`, and an activity means `live` with an enabled activity.
- After the key check, moves are rate-limited per user and event: 30 per minute, counted in `private.rate_limits` under `set_flow:<event id>`. `consumeEventRateLimit` in `rate-limit.ts` builds that key and is meant for the other actions that run after the key check, such as `update_party_content`.

**Why:** Keeping the rules in a plain TypeScript function makes them readable in one table. The compare-and-set and the constraint make sure the database never holds a broken flow, whatever the function does. Counting per event lets a host who runs two events keep their limit on each.

## 2026-10-21: How the admin key check and `claim_host` work (#18)

**Decision:**
- Every host action except `create_event` starts with `authorizeHost(db, caller, code, key)` in `supabase/functions/host-actions/admin-key.ts`, which answers the event id or `not_authorized`/`rate_limited`. Request schemas spread `hostLinkFields` (`code`, `key`) from `src/lib/schemas/host-actions.ts`.
- The stored hash comes from a service-role-only RPC, `event_admin_key_hash(code)`, which finds no row for an unknown or expired code. The function hashes the received key and compares the two hex hashes in constant time in TypeScript. An unknown code is compared against a dummy hash, so both paths do the same work.
- A wrong key, a key for another event, an unknown code and an expired event all answer `403 {"error":"not_authorized"}`.
- Only failed key checks are counted, as `admin_key_failure` in `private.rate_limits`: 10 per user per 10 minutes. Before checking a key, the read-only RPC `rate_limit_reached` asks whether the caller is over the limit; if so, even the right key answers `rate_limited` until the window has passed. Parallel requests can each pass that check before a failure is counted, which gives a burst a few extra guesses at a 256-bit key and was accepted.
- `claim_host(caller, target_event_id)` upserts the member row as `host`. A guest or TV of the event becomes host in their existing row, and a guest's display name is cleared (hosts have none), which frees the name for other guests. It answers `{}`.

**Why:** Postgres has no constant-time text comparison, and the key never reaches SQL, so the comparison happens in the function. Counting only failures means a host who reopens the link many times is never locked out. Refusing the right key while over the limit means a guesser learns nothing from an attempt made over the limit.

## 2026-10-21: How `host-actions` and `create_event` work (#17)

**Decision:**
- The function reaches `private` through two `public` RPCs that only `service_role` may execute: `create_event` (inserts the event, its admin key hash and the host member in one transaction, and answers null on a code clash so the function retries with a new code) and `consume_rate_limit` (a fixed window per user and counter name, counting every attempt). The Data API exposes only `public`, so this avoids a direct Postgres connection and a new driver dependency.
- The admin key is generated, hashed and returned in the function; the database only ever sees the hash. The hash is SHA-256 of the key's text as it appears in the host link, stored as lowercase hex in `private.event_secrets`. The event code is generated in the function with rejection sampling, so every character is equally likely.
- The gateway's JWT check is off for `host-actions` (`verify_jwt = false` in `supabase/config.toml`), because it would refuse CORS preflights. The function checks the caller's session itself with `auth.getUser`; the publishable or anon key alone is refused as `not_authenticated`.
- Checks run in this order: CORS, method, body size (32 KiB, read as a capped stream, so an oversized body is never parsed), JWT, the Zod request union, the action's rate limit. `create_event` allows 5 per user per hour.
- A request with an `Origin` that isn't in `ALLOWED_ORIGINS` is refused with `origin_not_allowed`, preflight or not. A request without `Origin` doesn't come from a browser page, so CORS doesn't apply; it still needs a valid session.
- Error codes so far: `invalid_request`, `not_authenticated`, `origin_not_allowed`, `method_not_allowed`, `payload_too_large`, `rate_limited`, `internal_error`, listed once in `src/lib/schemas/host-actions.ts`. The app's wrapper adds `network_error` for a call that got no answer, and maps any answer it doesn't recognise to `internal_error`.
- `events.party` is `{ welcome?, menu?, schedule?, wifi?, musicUrl? }` (`src/lib/schemas/party.ts`): every part optional, unknown fields refused, the music link https only.
- Shared schemas import only `zod` and relative paths with a `.ts` extension, because the function imports them under Deno. Niche ids therefore live in `src/niches/ids.ts`, and the typecheck makes `niches` list exactly those ids.
- `npm run test:db` serves this checkout's functions itself (`supabase/tests/functions-setup.ts`), with `ALLOWED_ORIGINS` from a test env file in `supabase/.temp/`. The local gateway answers every preflight itself with `*`, unlike the hosted one, so the preflight tests call the edge runtime directly from inside the Docker network.

**Why:** The ticket left these details open. Generating the key in the function keeps it out of SQL statements and database logs. Counting every `create_event` attempt, not only failures, is what limits flooding.

## 2026-10-21: How the join RPCs and db tests work (spec 1 build)

**Decision:**
- `join_event` and `join_tv` return a `join_result` (`event_id`, `error`) instead of raising. On success `error` is null; otherwise it holds the code (`not_found`, `ended`, `name_taken`, `invalid_name`, `rate_limited`) and `event_id` is null. Calling without a session is refused by Postgres before the function runs.
- Codes are matched in upper case with surrounding whitespace removed, so a guest can type `ab3xyz `.
- An existing member who calls a join RPC again gets the event id back with nothing changed, whatever their role, also after the event has ended. Only a new join to an `ended` event answers `ended`.
- Display names are trimmed of whitespace including no-break and zero-width spaces, by one function (`private.clean_display_name`) that both the members trigger and `join_event` use.
- Throttling is a fixed window per user: the first failure starts a one-minute window, and the tenth failure in it blocks both RPCs until the window ends. Each join locks the caller's counter row, so parallel requests are counted one at a time. Limit and window are `private.join_failure_limit()` and `private.join_failure_window()`; the retention is `private.event_retention()`.
- A guest renames themselves with a normal `update` on `display_name`. A name clash is a unique violation on `members_guest_name_key`, which the data layer maps to `name_taken`; a bad length is a check violation it maps to `invalid_name`.
- `role`, `status` and `phase` are `text` with `check` constraints, not Postgres enums, so values can be added and removed with a plain migration. The data layer narrows them with Zod.
- The db tests live in `supabase/tests/` with their own `tsconfig.db.json`, and are exempt from the ESLint rule that keeps Supabase inside `src/api/` (CLAUDE.md principle 3), because they test the database through the client directly. They read the URL and keys from `supabase status`, and use `psql` inside the database container only for the catalog guardrails and to move the server-only throttle window.
- The local stack allows 10,000 anonymous sign-ins an hour (`supabase/config.toml`), because every `npm run test:db` signs in about 150 fresh users. The hosted project keeps the limit set in its dashboard.

**Why:** A raised error rolls back the whole call, which would also roll back the failure counter, so errors have to be returned for throttling to work. Returning every code the same way keeps the data layer simple. The rest follows the spec; these are the details it left open.

## 2026-10-21: The backend core is built as two specs

**Decision:**
- The rest of the backend core plan is split into two specs, each built as one PR. Spec 1 is the database, its RLS and the join RPCs. Spec 2 is `host-actions`, the function typecheck, `src/api/` with realtime, and admin key parsing.
- Spec 1 creates no `private.event_secrets`. That table arrives with `create_event` in spec 2. Spec 1's tests seed events and host members with the service role.
- The shared module interface (Step 7) moves to the first module's spec.
- Tests use only three seams: the Supabase client signed in as each role (RLS and RPCs), `host-actions` over HTTP, and `src/api/` (realtime and the wrappers). One test reads the database catalog directly to check that every table in `public` has RLS on; it's an intended guardrail, not a fourth seam.

**Why:** The owner reviews the migration and RLS, the most security-sensitive code, in a small PR before anything is built on it. One spec was rejected as one large review. An interface written before any module exists is a guess; the quiz will give it a real shape. Testing only through the doors the app and an attacker use keeps the tests valid when the inside changes.

## 2026-10-21: CAPTCHA is added before the public launch, not in the backend core

**Decision:** The backend core has no CAPTCHA. Before Mingle is shared publicly, anonymous sign-in gets a CAPTCHA, using Cloudflare Turnstile (free) through Supabase's built-in support, with the widget on the join and create pages.

**Why:** There are no pages to put it on yet. Until launch, the join RPCs and `host-actions` are rate-limited per user and Supabase limits anonymous sign-ins per IP. Never adding it was rejected, because bots could create many sessions once Mingle is public. Building it now was rejected as setup with nothing to attach it to.

## 2026-10-21: Event data is kept for 30 days after creation (open question E)

**Decision:** `events.expires_at` is set to 30 days after `created_at`, from one constant in the migration. An expired event counts as no membership at once, and the later `cleanup` function deletes it and everything that belongs to it.

**Why:** 30 days covers a few weeks of preparation plus the summary page afterwards, without keeping guest names and answers longer than needed. 14 days was rejected because a host who prepares two weeks ahead would lose the event before the party. 90 days was rejected as keeping personal data longer than the evening needs. It's one constant, so it's easy to change.

## 2026-10-21: The TV joins with the event code (TV as a member)

**Decision:** The TV opens `/tv/:code` and joins with the event code through `join_tv`, which makes it a `tv` member. There is no separate TV token.

**Why:** A TV member can read nothing a guest can't (the event, its members, approved content and revealed results), and the code is shown on the TV anyway. Anyone with the code can register as a TV, which is no more exposure than joining as a guest. The stricter option, a secret TV link from the host panel, was rejected as one more link for the host to manage and more to build and test, without protecting anything.

## 2026-10-21: Edge Function code is typechecked with `deno check`

**Decision:** Add the `deno` npm package as a dev dependency and a `typecheck:functions` script that runs `deno check` on `supabase/functions/`. It is added before `host-actions` is built (in the backend core spec, ahead of the `host-actions` tickets), not in the Step 1 tooling PR.

**Why:** The Step 1 spike showed that `supabase functions serve` only strips types, and the app's `tsc -b` doesn't cover `supabase/functions/`, so function code was only linted. The rejected alternatives were relying on lint plus integration tests, and running `tsc` on the functions, which doesn't understand `npm:` specifiers or Deno types without extra setup.

## 2026-10-21: AI suggestions are an optional bonus; niches ship built-in content

**Decision:**
- Mingle works fully without AI. Each niche ships built-in content in Swedish and English: quiz questions, award categories and hot takes. The host picks from it and adds their own.
- The built-in content is written with Claude Code and reviewed by the owner before it's merged, so it is approved content under principle 6.
- AI suggestions are a bonus on top. When no AI key is configured, the app hides them.
- The AI provider is chosen when AI gets its own plan: the Claude API, or a free tier such as Gemini's (check its data terms first). Whichever it is, it's called only from the `ai-suggest` Edge Function, its output is validated and stored as drafts until the host approves, and prompts never include guest names or other personal data.

**Why:** Running Mingle should cost nothing at small scale. The free plans of Supabase and Vercel cover hosting, and AI is the only part that always costs money (estimated on this date at about 2 cents per party on Claude Haiku 5.5 and about 70 cents on Claude Opus 5.5). Built-in content is free, instant and has no rate limits, and it's reviewed once instead of at every party, which matters because AI-written trivia can get facts wrong. Free AI tiers can change their quotas without notice and may use prompts to train models, so the app mustn't depend on them. Keeping personal data out of prompts makes the provider choice a question of quality and cost only. Keeping AI as the main source of content was rejected because of the running cost and the hard dependency on one paid API.

## 2026-10-21: Database specs are built on the desktop, one database ticket at a time

**Decision:** Specs that touch `supabase/` can be planned in any session, but `/implement-spec` for them runs on the desktop, where Docker runs the local Supabase stack. Tickets that touch `supabase/` are built one at a time; other tickets still run in parallel. The `implementer` and `merger` also run `format:check`, and `test:db` when the change touches `supabase/`. These specs get `/security-review` after `/diff-review`, their security-critical tickets run the `implementer` on Opus, and the security rules from the design go into ticket acceptance criteria. "Database rules" in `CLAUDE.md` is written now, before the backend core is built, so implementers and `/diff-review` check against it from the first ticket.

**Why:** `test:db` needs Docker. Cloud sessions can start Docker, but their network policy blocks the Supabase images (tested 2026-10-21), so cloud implementers couldn't test database code and test-first work would be guesswork. All worktrees share one local stack, and `db:reset` from one worktree replaces the schema under another. Separate stacks per worktree with their own ports were rejected as too much setup for a few tickets. `/diff-review` checks standards and the spec but not security, and this is the most security-sensitive code in the project.

## 2026-10-21: Agent workflow built on Matt Pocock's skills

**Decision:** Larger changes go grill, spec, tickets, implement, using skills copied from [mattpocock/skills](https://github.com/mattpocock/skills) (commit `5beb35b`) into `.claude/skills/`. Specs and tickets are GitHub issues and replace plans in `docs/plans/`. The main session orchestrates (Opus recommended); the `implementer` and `merger` subagents run on Sonnet and `Explore` on Haiku. Mingle's edits to the copies: `code-review` is renamed `diff-review`, decisions go to this file instead of `docs/adr/`, `to-spec` applies no triage label, and the setup is written by hand in `docs/agents/`, so `setup-matt-pocock-skills` isn't included.

**Why:** The skills already cover planning with the owner, ticket breakdown and per-ticket subagents, so only the model choice is ours. They're copied instead of installed as a plugin because cloud sessions don't load plugins. `code-review` clashes with Claude Code's built-in skill of the same name. GitHub Issues fits that GitHub is the only thing every device shares. A custom planner subagent was rejected because subagents can't ask the owner questions.

## 2026-10-20: The host's session is bound to the event (open question C)

**Decision:** The host signs in anonymously like guests and the TV. When `host-actions` verifies the admin key (`create_event` or `claim_host`), it records that session as `host` in `members`. RLS then lets the host read everything in their event, including drafts and individual answers, directly and through realtime. Every host write still goes through `host-actions` with the admin key, as `CLAUDE.md` principle 2 requires.

**Why:** The host panel needs live data that guests must not see. Binding the session lets RLS and realtime serve it. The rejected alternative was routing every host read through the Edge Function, which keeps RLS simpler but gives the host panel no realtime, so it would have to refetch or poll. A side effect is that anyone who opens the host link on another device becomes a co-host, which matches what a shared admin link means.

## 2026-10-20: Server-only tables live in a `private` schema

**Decision:** Secrets and internal counters (the admin key hash and rate limits) go in a `private` schema that the Data API doesn't expose. RLS stays enabled on them with no client policies, on purpose.

**Why:** Keeping the admin key hash out of `public` means no policy mistake can leak it. The "a table without policies is a bug" rule in `CLAUDE.md` applies to tables clients can reach; `private` tables are server-only by design.

## 2026-10-20: Database and RLS tests run against a local Supabase stack

**Decision:** Add the Supabase CLI as a dev dependency once the backend core plan is approved. Schema, RLS, RPCs and Edge Functions are tested by Vitest integration tests (`*.db.test.ts`) that sign in as each role against a local stack in Docker, run with `npm run test:db`. `npm run test` stays fast and needs no Docker.

**Why:** RLS is where a bug would hurt most, so it's tested through the real client the app uses, in the same language and runner as the rest of the tests. pgTAP (tests in SQL) was rejected as a second test language. A hosted test project was rejected because it needs extra secrets and a project to maintain. The cost is that cloud sessions without Docker can't run `test:db`, so it's run on the desktop before merging.

## 2026-10-20: The backend core creates only the shared tables

**Decision:** The backend core migration creates `events` and `members` (plus the `private` tables). Each module plan adds its own typed tables, following the draft/approved and answer-visibility pattern in [`docs/plans/backend-core.md`](plans/backend-core.md).

**Why:** Typed tables per module keep database constraints meaningful. Generic `module_items`/`responses` tables with JSON payloads would save a few migrations but move all checks into application code.

## 2026-10-15: shadcn/ui 4 setup with Radix, the cn package and the Geist font

**Decision:**
- Initialize shadcn/ui 4 with Radix primitives and the "nova" preset (style `radix-nova`, neutral colors, Lucide icons).
- Accept the dependencies that setup brings, all three beyond the original foundation plan:
  - `cn`, shadcn's own class-merging package. It replaces `clsx` + `tailwind-merge`.
  - `shadcn` as a **dev** dependency, because `src/index.css` imports `shadcn/tailwind.css`.
  - `@fontsource-variable/geist`, the preset's self-hosted font, until the visual design picks one.

**Why:** shadcn 4 changed its setup after the plan was written. A trial run in a scratch copy showed exactly what `init` adds.
- Keeping the generated setup means future `shadcn add` components work without edits. Copying the CSS file into the repo, or hand-writing the older `clsx` setup, was rejected for that reason.
- The `shadcn` package pulls in about 270 install-time packages. It's listed as a dev dependency, because only its CSS reaches the browser.
- The font is self-hosted, so pages make no requests to third-party font servers.

**Known issue:** `npm audit` reports 7 high-severity findings, all from a single advisory (GHSA-vfj7-8cjw-p6xm: `braces` ≤3.0.3, a denial of service through deeply nested glob patterns). It reaches us only through the shadcn CLI's `fast-glob`. There is no patched `braces` release yet. The CLI only runs locally on our own files, so this is accepted for now. Revisit when a fix is published.

## 2026-10-15: Stay on TypeScript 6.0 for now

**Decision:** Pin TypeScript to ~6.0. Upgrade to 7 once typescript-eslint supports it.

**Why:** TypeScript 7 is the compiler rewritten in Go. It's faster, but the language is the same as 6.0. typescript-eslint's type-aware rules (for example `no-floating-promises`, which catches unhandled Supabase calls) use the JavaScript compiler API that TypeScript 7 doesn't provide in the same way. Even the newest typescript-eslint canary only accepts TypeScript `<6.1`. Moving to TypeScript 7 now would have meant dropping those rules, for a speed gain this codebase doesn't need yet.

## 2026-10-15: Admin key goes in the URL fragment

**Decision:** The host link is `/host/:code#key=…`, not `/host/:code?key=…`. The host still saves the link to get back into the control panel.

**Why:** A query string is sent to the server on page load and can end up in hosting logs. A fragment never leaves the browser. The host experience is the same either way.

## 2026-10-15: ESLint and Prettier for lint and formatting

**Decision:** Use ESLint (typescript-eslint, React hooks rules) for linting and Prettier for formatting.

**Why:** The working agreement requires lint, but no tool was chosen. ESLint is the Vite React default. Prettier keeps code from desktop, phone and cloud sessions consistent, so diffs stay clean. Biome was considered but is less common with Vite and shadcn/ui.

## 2026-10-15: npm is the package manager

**Decision:** Use npm. Cloud sessions install with `npm ci`.

**Why:** `docs/workflow.md` already assumes `npm ci`, and one lockfile keeps desktop and cloud builds the same.

## 2026-10-15: UI language follows the event, and users can switch

**Decision:** The UI defaults to the event's language. Every user (host, guest, TV) can switch between Swedish and English, and the choice is remembered per device. Content the host wrote or approved (questions, welcome text, menu) stays in the event language. Only the UI around it switches.

**Why:** Guests at a Swedish event may prefer English and vice versa, but translating host content would mean showing text the host never approved.

## 2026-10-15: Folders for hooks, layouts and the module registry

**Decision:** Add `src/hooks/` (shared React hooks that call `src/api/`), `src/layouts/` (host, TV and guest shells) and `src/modules/registry.ts`.

**Why:** The folder structure had no place for these. Without one, they end up scattered across views and modules.

## 2026-10-15: Module data access lives in src/api/

**Decision:** All Supabase access stays in `src/api/`, with one file per module (`src/api/quiz.ts`, `src/api/awards.ts`, `src/api/hottakes.ts`). Modules in `src/modules/<name>/` own their UI and types, but not data access.

**Why:** `CLAUDE.md` contradicted itself: principle 3 kept Supabase in `src/api/`, while principle 5 gave each module its own API functions. Keeping data access in one folder makes the import boundary easy to enforce with lint and easy to review for security, which matters most in this project (RLS, approved-only content, host-only actions). Colocating API code inside each module was rejected because database calls would spread across many folders.

## 2026-10-14: GitHub is the hub for all work

**Decision:** Work happens in three places: Claude Code on the desktop, cloud sessions started from the Claude mobile app, and Remote Control into a running desktop session. All of it goes through one branch and one PR per task on GitHub. Only the repo owner merges, using squash merge. Plans and decisions are written into the repo (`docs/plans/`, this file), not left in chats.

**Why:** The desktop is not left running, so work from the phone runs as cloud sessions, and those only see what is pushed to GitHub. Chats are not shared between sessions or devices, so anything a later session needs has to live in the repo.
