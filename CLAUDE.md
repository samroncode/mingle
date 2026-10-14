# CLAUDE.md

> Product name: **Mingle**. Repo/package name: `mingle`.

## What this project is

A web app that lets anyone set up an interactive party evening in a few minutes. A host creates an event, picks a niche (afterwork, team event, bachelor/bachelorette party), and gets ready-made activities: a quiz, award voting and hot-take polls. Guests join from their phones by scanning a QR code shown on the TV, and the results appear live on the big screen.

### The problem it solves
Every time someone hosts an afterwork, team event or bachelor party, they build the entertainment from scratch: quiz questions in a doc, votes by show of hands, nothing on the TV. Kahoot-style tools are generic and need content written up front. Mingle gives the host **niche-specific content suggestions (AI-assisted, always host-approved)** and **one place to run the whole evening**.

### Who uses it
- **Host**: creates and runs the evening from their phone.
- **Guests**: join with a code or QR, no account, just a display name.
- **TV**: a browser on a TV or laptop showing the shared screen.

## Scope for v1

### Core concept: two layers
1. **Party screen (always on, zero effort).** The TV must be good even if the host never starts an activity. When no activity is running, the TV rotates calmly between: welcome message, join QR code, music and wifi QR codes, menu, evening schedule, and guests who have joined.
2. **Activities (optional).** Quiz, Awards and Hot takes are things the host *can* start, never must. Every activity can be turned off in the create flow.

In scope:
- **Party screen** (TV idle state) as described above
- Create flow (wizard): niche, language, guest names, vibe, themes, welcome message, menu, schedule, wifi details, and **which activities to use** (niche config sets the defaults; the host can turn any activity on or off). AI may suggest welcome text, menu wording and schedule; the host approves.
- Three modules: **Quiz**, **Awards** ("most likely to…" voting on guest names), **Hot takes** (agree/disagree polls)
- Optional **music link**: the host can paste a Spotify Jam or shared playlist link, shown as a QR code in the TV lobby (link only, no Spotify API integration)
- AI suggestions for module content, generated on request; the host reviews, edits, deletes and approves before anything is shown
- Host control panel: start/stop modules, advance questions, reveal results
- TV view: lobby with QR code, live module view, results
- Guest view: join, answer, vote
- Summary page after the event
- Swedish and English UI; AI content generated in the event's language
- Automatic deletion of event data after a fixed retention period

Out of scope for v1 (do not build unless asked):
- Competitions and leaderboard (planned for v1.1)
- Everything in `IDEAS.md` — it is a parking lot, not a backlog. Do not build from it unless asked.
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
| AI | Claude API, called **only** from a Supabase Edge Function | Keeps the API key server-side and lets us rate-limit per event |
| Validation | Zod | Shared schemas for forms, API payloads and AI output |
| i18n | react-i18next | Swedish + English, well-known |
| Hosting | Vercel (frontend), Supabase (backend) | Free tiers, simple deploys |
| Testing | Vitest (unit), Playwright (key flows) | Standard for this stack |

## Views and routes

| Route | Who | Purpose |
|---|---|---|
| `/` | Everyone | Landing page |
| `/new` | Host | Create wizard |
| `/host/:code?key=…` | Host | Control panel (secret admin link) |
| `/tv/:code` | TV | Shared big-screen view |
| `/p/:code` | Guests | Join and play |
| `/p/:code/summary` | Everyone | Post-event summary |

One app serves every event. Events are rows in the database identified by a short code. **No per-event pages are generated or deployed.**

## Architecture principles

1. **The database is the source of truth.** The event's state (`current_module`, `current_step`, `status`) lives in Postgres. TV and guest views subscribe through Realtime and render that state. No client holds authoritative state.
2. **The host is the only one who changes event flow.** Every host action goes through an Edge Function that verifies the admin key (stored hashed). Guests can only write their own answers and votes, enforced by RLS.
3. **All data access lives in one layer.** Supabase calls only happen in `src/api/`. Components never import the Supabase client directly.
4. **Niches are data, not branches.** Each niche is a config object in `src/niches/` (theme tokens, default modules, prompt hints, copy). Add a niche by adding a config file. Never scatter `if (niche === 'aw')` checks through components.
5. **Modules are self-contained.** Each module in `src/modules/<name>/` has its own host, TV and guest components plus its own types and API functions, and implements a shared module interface.
6. **AI output is untrusted until approved.** Validate every AI response with Zod. Store it as `draft`. Only host-approved items (`approved`) are ever shown to guests or on the TV.
7. **All UI text goes through i18n.** No hardcoded user-facing strings. Code, identifiers and comments are in English.
8. **Theming via CSS variables.** Niche themes set tokens on `:root` or a wrapper element; components use tokens, never hardcoded colors.
9. **Small, single-purpose functions and components.** Prefer composition. Keep files short.
10. **TypeScript strict mode.** No `any`. Database types are generated from the Supabase schema.

## Folder structure

```
src/
  api/          # all Supabase access (queries, mutations, realtime subscriptions)
  partyscreen/  # TV idle state: welcome, QR codes, menu, schedule, guests
  modules/      # quiz/, awards/, hottakes/ — each with host/, tv/, guest/ parts
  niches/       # aw.ts, team.ts, bachelor.ts — config objects
  views/        # route-level pages: create, host, tv, guest, summary
  components/   # shared UI (shadcn/ui lives in components/ui)
  i18n/         # sv.json, en.json
  lib/          # pure helpers, schemas (Zod)
supabase/
  migrations/   # SQL schema + RLS policies
  functions/    # edge functions: host-actions, ai-suggest, cleanup
```

## Data rules

- Events expire and are deleted after a fixed retention period (scheduled cleanup function).
- Store only display names for guests. No emails, phone numbers or other personal data.
- RLS is enabled on every table. A new table without policies is a bug.

## Things the agent must NOT do

- Do not switch database, backend provider, framework or hosting.
- Do not add new dependencies without asking first.
- Do not call the Claude API or expose its key from the browser.
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
- After changes: run typecheck, lint and tests, and report the result.
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

### Plans and decisions
- For larger changes, write the plan to `docs/plans/<short-name>.md` and get it approved (in chat or on the PR) before building.
- When a product or architecture decision is made, add it to `docs/decisions.md` in the same PR.
- If a decision changes a rule in this file, update this file in the same PR.

### Cloud sessions
- Cloud sessions clone from GitHub. Work that is not pushed does not exist there, so push before handing work off.
- Secrets come from the cloud environment's variables, or a local `.env` on the desktop. List every variable in `.env.example` without real values. This repo is public.

## Design

Visual design (screens per view and niche themes) is defined separately. Until it exists, use shadcn/ui defaults with theme tokens so the design can be applied without rewriting components.
