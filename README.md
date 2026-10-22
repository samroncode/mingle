# Mingle

Set up an interactive party evening in a few minutes. A host creates an event, picks a niche (afterwork, team event, bachelor/bachelorette party) and gets ready-made activities. Guests join from their phones by scanning a QR code on the TV, and results show up live on the big screen.

> **Status:** early development. The backend core (database, security rules, joining, host actions and live updates) and the setup wizard are built. The TV party screen, the guest screens and the activities are not built yet.

## Why

Every afterwork, team event or bachelor party ends up with entertainment built from scratch: quiz questions in a doc, votes by show of hands, nothing on the TV. Generic quiz tools need content written up front. Mingle gives the host ready-made, niche-specific content and one place to run the whole evening.

## How it works

There are three views, all served by one app:

| View | Who | What it does |
|---|---|---|
| Host | The person running the evening | Creates the event and controls it from their phone |
| TV | A browser on a TV or laptop | Shows the shared screen: lobby, activities, results |
| Guest | Everyone else, no account needed | Joins with a code or QR, picks a display name, answers and votes |

### Two layers

1. **Party screen (always on).** With no activity running, the TV rotates between a welcome message, join QR code, music and wifi QR codes, menu, schedule and the guests who have joined.
2. **Activities (optional).** The host can start any of these, and can switch any of them off when creating the event:
   - **Quiz**
   - **Awards**: "most likely to…" voting on guest names
   - **Hot takes**: agree/disagree polls

Each niche comes with built-in quiz questions, award categories and hot takes in Swedish and English. The host picks from them and adds their own. AI suggestions are an optional bonus: nothing they produce is shown to guests or on the TV until the host has reviewed and approved it.

## Tech stack

- Vite, React, TypeScript (strict)
- Tailwind CSS v4 and shadcn/ui
- React Router
- Supabase: Postgres, Realtime, Storage, Edge Functions, anonymous sign-in
- Optional AI suggestions, called only from a Supabase Edge Function
- Zod for validation, react-i18next for Swedish and English
- Vitest and Playwright for testing, ESLint and Prettier for code quality
- Hosted on Vercel (frontend) and Supabase (backend)

## Getting started

You need Node 24 (see `.nvmrc`) and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Then open http://localhost:5173. The app also starts without `.env`. The Supabase settings in it (project URL and publishable key) are only needed once a feature reads data.

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Typechecks and builds for production |
| `npm run typecheck` | Runs TypeScript |
| `npm run lint` | Runs ESLint |
| `npm run format` / `npm run format:check` | Formats with Prettier / checks formatting |
| `npm run test` | Runs the Vitest tests once (`npm run test:watch` keeps them running) |
| `npm run test:e2e` | Runs the Playwright browser tests at phone size, with Supabase faked (no Docker). On a desktop, run `npx playwright install chromium` once first |

## What's where

```
src/            The app (Vite + React + TypeScript), with its own tsconfig.json
  api/          All Supabase access: queries, mutations, realtime
  app/          App shell: main.tsx, router, global CSS, layouts (host, TV, guest)
  views/        Route-level pages, one folder each: create, host, tv, guest, landing, summary, shared
  partyscreen/  TV idle state: welcome, QR codes, menu, schedule, guests
  modules/      Activities (quiz, later awards and hot takes), each with host, TV and guest parts
  niches/       One config object per niche: theme, default modules, built-in content
  components/   Shared UI (shadcn/ui in components/ui)
  hooks/        Shared React hooks that call src/api/
  lib/          Helpers by area (host, guest, tv, wizard), Zod schemas
  i18n/         Swedish and English UI text
supabase/       The backend
  migrations/   Database schema and Row Level Security policies
  functions/    Edge Functions (host-actions)
  tests/        Database tests against the local stack, with their own tsconfig.json
e2e/            Playwright browser tests and playwright.config.ts, Supabase faked
scripts/        Small Node scripts used by npm scripts
docs/           Decisions, workflow, guides, plans and ideas
.github/        PR template and the deploy workflows
```

Everything else at the root is config that tools look for there: `package.json`, `tsconfig.json` and `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `vercel.json`, `components.json` and dotfiles.

### Architecture in short

```
Host phone ──► Edge Function (host-actions) ──► Postgres ──► Realtime ──┬─► TV
 (admin key)       checks the key, changes       source of     pushes     └─► Guest phones
                   the event's state             truth         changes        (write only their own
                                                                             answers, via RLS)
```

- The database holds the event's state (`current_module`, `current_step`, `status`). TV and guest views subscribe and render it; no client holds authoritative state.
- Only the host changes the event flow, always through an Edge Function that verifies the admin key. Guests sign in anonymously and can only write their own answers and votes, enforced by Row Level Security.
- Components never import the Supabase client. Everything goes through `src/api/`.
- Niches are config objects and activities are self-contained modules, so adding one means adding a folder, not editing components.
- AI suggestions are optional, run only in an Edge Function, and stay drafts until the host approves them.

## Project documents

- [CLAUDE.md](CLAUDE.md): scope for v1, architecture principles, folder structure and working rules
- [docs/IDEAS.md](docs/IDEAS.md): parking lot for ideas that are not part of v1
- [docs/workflow.md](docs/workflow.md): how work moves between the desktop, the phone and GitHub
- [docs/supabase.md](docs/supabase.md): how Mingle uses Supabase, and how to run it locally with Docker
- [docs/decisions.md](docs/decisions.md): log of product and architecture decisions
- [docs/plans/](docs/plans/): earlier plans, kept as a record (larger changes are now specs on GitHub Issues)
- [docs/implementation.md](docs/implementation.md): step-by-step log of building the foundation with Claude Code in plan mode

## Privacy

Guests are identified by a display name only. No emails, phone numbers or other personal data are stored, and event data is deleted automatically after a fixed retention period.
