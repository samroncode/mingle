# Decisions

Product and architecture decisions, newest first. Add an entry in the same PR whenever a decision is made, in a chat or on a PR, so that later sessions on any device know about it. `CLAUDE.md` holds the standing rules; this file records when and why they were set.

Entry format:

```markdown
## YYYY-MM-DD: Short title

**Decision:** What was decided.

**Why:** The reason, and any alternatives that were rejected.
```

## 2026-10-21: Agent workflow built on Matt Pocock's skills

**Decision:** Larger changes go grill, spec, tickets, implement, using skills copied from [mattpocock/skills](https://github.com/mattpocock/skills) (commit `5beb35b`) into `.claude/skills/`. Specs and tickets are GitHub issues and replace plans in `docs/plans/`. The main session orchestrates (Opus recommended); the `implementer` subagent runs on Sonnet and `Explore` on Haiku. Mingle's edits to the copies: `code-review` is renamed `diff-review`, decisions go to this file instead of `docs/adr/`, and the setup is written by hand in `docs/agents/`, so `setup-matt-pocock-skills` isn't included.

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
