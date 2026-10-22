# CLAUDE.md

> Product name: **Mingle**. Repo/package name: `mingle`.

## What this project is

A web app that lets anyone set up an interactive party evening in a few minutes. A host creates an event, picks a niche (afterwork, team event, bachelor/bachelorette party), and gets ready-made activities: a quiz, award voting and hot-take polls. Guests join from their phones by scanning a QR code shown on the TV, and the results appear live on the big screen.

### The problem it solves
Every time someone hosts an afterwork, team event or bachelor party, they build the entertainment from scratch: quiz questions in a doc, votes by show of hands, nothing on the TV. Kahoot-style tools are generic and need content written up front. Mingle gives the host **ready-made, niche-specific content** (with optional AI suggestions, always host-approved) and **one place to run the whole evening**.

### Who uses it
- **Host**: creates and runs the evening from their phone.
- **Guests**: join with a code or QR, no account, just a display name.
- **TV**: a browser on a TV or laptop showing the shared screen.

## Scope for v1

### Core concept: two layers
1. **Party screen (always on, zero effort).** The TV must be good even if the host never starts an activity. When no activity is running, the TV rotates calmly between: welcome message, join QR code, music and wifi QR codes, menu, evening schedule, and guests who have joined.
2. **Activities (optional).** Quiz, Awards and Hot takes are things the host *can* start, never must. Every activity can be turned off in the setup wizard.

In scope:
- **Party screen** (TV idle state) as described above
- Setup wizard: niche, language, welcome message, menu, schedule, wifi details, music link, and **which activities to use** (niche config sets the defaults; the host can turn any activity on or off). When AI is enabled, it may suggest welcome text, menu wording and schedule; the host approves.
- Three modules: **Quiz**, **Awards** ("most likely to…" voting on guest names), **Hot takes** (agree/disagree polls)
- Optional **music link**: the host can paste a Spotify Jam or shared playlist link, shown as a QR code in the TV lobby (link only, no Spotify API integration)
- **Built-in content per niche**: quiz questions, award categories and hot takes in Swedish and English. The host picks from it and adds their own.
- **Optional AI suggestions** (a bonus, never required): generated on request and hidden when no AI key is configured. The host reviews, edits, deletes and approves before anything is shown.
- Host control panel: start/stop modules, advance questions, reveal results
- TV view: lobby with QR code, live module view, results
- Guest view: join, answer, vote
- Summary page after the event
- Swedish and English UI; content (built-in or AI) in the event's language
- Automatic deletion of event data after a fixed retention period

Out of scope for v1 (do not build unless asked):
- Competitions and leaderboard (planned for v1.1)
- Everything in `docs/IDEAS.md` — it is a parking lot, not a backlog. Do not build from it unless asked.
- Photo slideshow (stretch goal after v1 is complete)
- Host accounts or login
- Spotify (or other music service) API integration — music is a pasted link only
- Payments, analytics or tracking
- Native apps

## Tech stack and why

| Area | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast, well-known, LLM-friendly |
| Styling | Tailwind CSS v4 + shadcn/ui | Consistent components, easy theming via CSS variables |
| Routing | React Router | Standard, simple route-based views |
| Backend | Supabase (Postgres, Realtime, Storage, Edge Functions) | Realtime sync between TV, host and guests without running our own server |
| Guest identity | Supabase anonymous sign-in | Gives every guest an `auth.uid()` for Row Level Security without an account |
| AI (optional) | Provider chosen in the AI plan (the Claude API or a free tier), called **only** from a Supabase Edge Function | Keeps the API key server-side and lets us rate-limit per event; the app works without it |
| Validation | Zod | Shared schemas for forms, API payloads and AI output |
| i18n | react-i18next | Swedish + English, well-known |
| Hosting | Vercel (frontend), Supabase (backend) | Free tiers, simple deploys |
| Testing | Vitest (unit), Playwright (key flows) | Standard for this stack |
| Lint and format | ESLint + Prettier | Vite default linter; one format across desktop, phone and cloud sessions |

## Views and routes

| Route | Who | Purpose |
|---|---|---|
| `/` | Everyone | Landing page |
| `/new` | Host | Create wizard |
| `/host/:code#key=…` | Host | Control panel (secret admin link; the key is in the fragment so it never reaches the server) |
| `/tv/:code` | TV | Shared big-screen view |
| `/p/:code` | Guests | Join and play |
| `/p/:code/summary` | Everyone | Post-event summary |

One app serves every event. Events are rows in the database identified by a short code. **No per-event pages are generated or deployed.**

## Architecture principles

1. **The database is the source of truth.** The event's state (`current_module`, `current_step`, `status`) lives in Postgres. TV and guest views subscribe through Realtime and render that state. No client holds authoritative state.
2. **The host is the only one who changes event flow.** Every host action goes through an Edge Function that verifies the admin key (stored hashed). Guests can only write their own answers and votes, enforced by RLS.
3. **All data access lives in one layer.** Supabase calls only happen in `src/api/`. Components never import the Supabase client directly. The only exception is the db tests in `supabase/tests/`.
4. **Niches are data, not branches.** Each niche is a config object in `src/niches/` (theme tokens, default modules, built-in content, prompt hints, copy). Add a niche by adding a config file. Never scatter `if (niche === 'aw')` checks through components.
5. **Modules are self-contained.** Each module in `src/modules/<name>/` has its own host, TV and guest components plus its own types, and implements a shared module interface. Its data access lives in `src/api/<name>.ts` (principle 3).
6. **AI is optional, and its output is untrusted until approved.** The app works fully without AI. Validate every AI response with Zod. Store it as `draft`. Only host-approved items (`approved`) are ever shown to guests or on the TV.
7. **All UI text goes through i18n.** No hardcoded user-facing strings. Code, identifiers and comments are in English. The UI defaults to the event's language, and any user can switch between Swedish and English (remembered per device). Content the host wrote or approved stays in the event language.
8. **Theming via CSS variables.** Niche themes set tokens on `:root` or a wrapper element; components use tokens, never hardcoded colors.
9. **Small, single-purpose functions and components.** Prefer composition. Keep files short.
10. **TypeScript strict mode.** No `any`. Database types are generated from the Supabase schema.

## Folder structure

```
src/
  api/          # all Supabase access (queries, mutations, realtime subscriptions); one file per module, e.g. api/quiz.ts
  hooks/        # shared React hooks that call src/api/
  layouts/      # host, TV and guest page shells
  partyscreen/  # TV idle state: welcome, QR codes, menu, schedule, guests
  modules/      # quiz/, awards/, hottakes/ — each with host/, tv/, guest/ parts; registry.ts lists them
  niches/       # aw.ts, team.ts, bachelor.ts — config objects and their built-in content
  views/        # route-level pages: create, host, tv, guest, summary
  components/   # shared UI (shadcn/ui lives in components/ui)
  i18n/         # sv.json, en.json
  lib/          # helpers, Zod schemas, wizard state and small browser-storage helpers (no Supabase)
supabase/
  migrations/   # SQL schema + RLS policies
  functions/    # edge functions: host-actions, ai-suggest
  tests/        # *.db.test.ts against the local stack (npm run test:db)
e2e/            # Playwright tests (npm run test:e2e), Supabase faked
scripts/        # small Node scripts used by npm scripts
docs/           # decisions, workflow, Supabase guide, glossary, ideas, plans and logs
```

Everything else at the root is config that tools look for there (`package.json`, `tsconfig*.json`, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `vercel.json`, `components.json`, dotfiles), plus `README.md` and this file.

## Data rules

- Events expire 30 days after they are created and are then deleted by the nightly cleanup, a pg_cron job in the database (no Edge Function). Codes of deleted events are never reused.
- Every foreign key to `public.events` is `on delete cascade`, so cleanup deletes everything that belongs to an event. A catalog test enforces it.
- Store only display names for guests. No emails, phone numbers or other personal data.
- Never send guest names or other personal data to an AI provider. Prompts carry only the event's settings and the niche's hints.
- RLS is enabled on every table. A new table in `public` without policies is a bug. Tables in the `private` schema are server-only: RLS is on and they have no client policies, on purpose (see `docs/decisions.md`).

## Database rules

These apply to everything under `supabase/`. How Supabase works in this project, and how to run it locally, is in `docs/supabase.md`.

- **Security lives in the database.** A guest who calls Supabase directly from devtools must not be able to do anything the app wouldn't let them do. RLS enforces this, never the UI.
- **Every schema change is a new migration** in `supabase/migrations/`. Never edit a migration that is already on `main`; add a new one.
- **`security definer` functions** set `search_path = ''` and use schema-qualified names (`public.events`), so they can't be tricked into using objects from another schema.
- **Errors are codes, not text.** RPCs and Edge Functions return codes such as `not_found` or `name_taken`; the UI maps them to i18n keys (principle 7).
- **Live changes only through the deploy workflow.** The hosted live project changes only when the Deploy workflow runs after the owner merges to `main`. Agents never run `supabase db push` or `supabase functions deploy` by hand. See `docs/hosting.md`.
- **Secrets stay server-side.** The service-role key and the AI provider's key exist only in the Edge Functions' environment and never get a `VITE_` prefix.
- **Generated types are never edited by hand.** `src/api/database.types.ts` comes from `npm run db:types`. Regenerate it after every migration.
- **Every policy, RPC and function has a test.** `*.db.test.ts` files in `supabase/tests/` sign in as real roles (non-member, guest, TV, host) against the local stack and run with `npm run test:db`. `supabase/tests/helpers.ts` has the seeding helpers; copy the pattern in `core.db.test.ts` for new tables. Removing a policy must make a test fail.

## Things the agent must NOT do

- Do not switch database, backend provider, framework or hosting.
- Do not add new dependencies without asking first.
- Do not call an AI API or expose its key from the browser.
- Do not show AI-generated content to guests or on the TV without host approval.
- Do not add host accounts, login, payments, analytics or tracking.
- Do not build the photo slideshow until the three v1 modules are done and approved.
- Do not access Supabase outside `src/api/`.
- Do not hardcode user-facing text, colors or niche-specific logic in components.
- Do not disable RLS or write policies that let guests change another guest's data or the event flow.
- Do not commit secrets or `.env` files.
- Do not rewrite unrelated code while solving a task. Keep changes scoped.

## Working agreement

- Before larger changes, propose a short plan and wait for approval.
- After changes: run typecheck (`npm run typecheck` and `npm run typecheck:functions`), lint and tests, and report the result.
- Write a migration for every schema change. Never edit the database by hand.
- When unsure about a product decision, ask instead of guessing.

## Git and PR workflow

Work on this repo happens in several places: Claude Code on the desktop, cloud sessions started from the phone, and Remote Control. GitHub is the only thing they share. The repo and its PRs are the record; a chat is not, because a session on another device cannot see it. The human side of this flow is described in `docs/workflow.md`.

### Branches and PRs
- Start every task from the latest `main`. In a local session, pull first.
- One task, one branch, one PR. Never commit or push directly to `main`.
- Keep PRs small and focused on that task.
- Fill in the PR description using `.github/pull_request_template.md`. Write "How to test" so it can be followed from a phone when possible.
- PRs are squash-merged, so the PR title becomes the commit message on `main`. Write it as a short imperative sentence.
- Only the repo owner merges. Do not merge PRs, force-push, or delete branches unless asked.

### Specs and decisions
- Larger changes go through the flow in "Agent skills" below. Get the spec and tickets approved before building.
- When a product or architecture decision is made, add it to `docs/decisions.md` in the same PR.
- New docs go in `docs/`. The repo root is for files that tools look for there, plus `README.md` and `CLAUDE.md`.
- If a decision changes a rule in this file, update this file in the same PR.

### Cloud sessions
- Cloud sessions clone from GitHub. Work that is not pushed does not exist there, so push before handing work off.
- Secrets come from the cloud environment's variables, or a local `.env` on the desktop. List every variable in `.env.example` without real values. This repo is public.

## Agent skills

Skills copied from mattpocock/skills live in `.claude/skills/`. The main session talks to the owner and orchestrates; subagents search and build.

1. `/grill-with-docs`: interview the owner until the change is clear.
2. `/to-spec`, then `/to-tickets`: the spec becomes a GitHub issue and the tickets its sub-issues.
3. `/implement-spec` builds a whole spec with one `implementer` subagent per ticket and one PR. `/implement` builds a single ticket in the main session.

Parallel tickets often both add entries to `src/i18n/*.json` or `src/modules/registry.ts`. Don't add a blocking edge for that; keep both sides when merging.

### Specs that touch the database

- **Plan anywhere, build on the desktop.** `/grill-with-docs`, `/to-spec` and `/to-tickets` work in any session. `/implement-spec` for a spec that changes `supabase/functions/` runs on the desktop, because the Edge Function tests can't run in a cloud session. Database-only tests can run in the cloud after `sudo dockerd &` and `npm run db:start` (see `docs/decisions.md`, 2026-10-22, and `docs/supabase.md`).
- **One database ticket at a time.** All worktrees share one local Supabase stack, and `db:reset` from one worktree replaces the schema under another. Start the next ticket that touches `supabase/` only after the previous one is merged. Other tickets still run in parallel.
- **Security rules go in the tickets.** The spec template leaves out details like "a wrong key and an unknown code return the same error". Put each one in the acceptance criteria of the ticket that builds it.
- **Opus for security-critical tickets.** Run the `implementer` with `model: opus` for tickets that write RLS policies, `security definer` functions or `host-actions`.
- **Security review before the PR is ready.** After `/diff-review`, also run `/security-review` on the integration branch, and give its findings to the same fix-up implementer.
- **Auto mode.** Background implementers can't stop to ask for permission. Switch the session to Auto mode before `/implement-spec`. `.claude/settings.json` pre-approves the routine commands for the other modes.

### Issue tracker

GitHub Issues, through `gh api` (REST only; cloud sessions block GraphQL). See `docs/agents/issue-tracker.md`.

### Domain docs

Single context: `docs/GLOSSARY.md` and `docs/decisions.md`. See `docs/agents/domain.md`.

## Design

Visual design (screens per view and niche themes) is defined separately. Until it exists, use shadcn/ui defaults with theme tokens so the design can be applied without rewriting components.
