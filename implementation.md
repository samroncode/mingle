# Implementation log: Part A

Running log of building the Mingle foundation with Claude Code in plan mode. Each step records the prompt, what the agent produced, and my review. The deliverable summary is at the bottom.

## Method

- Claude Code runs in **plan mode**. The agent proposes and I approve before anything is changed. It is not allowed to run freely.
- Each step is: prompt → agent output → my review → commit. Every step gets its own commit, so the history shows the flow and any step can be rolled back.
- Verification from Step 4 on (once there is code): `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run dev` starts the app. These are my check that "behavior has not changed".
- Decisions made along the way go into `docs/decisions.md`, and into `CLAUDE.md` when they change a rule.

---

## Step 1: Analysis of the foundation

### Prompt

> The codebase is empty except for CLAUDE.md and IDEAS.md. Based on CLAUDE.md, analyze what the foundation of the codebase should look like: folder structure, which parts should exist from the start, and where there is a risk of technical debt later if the foundation is done wrong. I only want an analysis, no solution and no code yet.

### What the agent identified

**Current state:** documentation only (`CLAUDE.md`, `IDEAS.md`, `README.md`, `docs/`, PR template, `.gitignore`). No `package.json`, `src/` or `supabase/`.

**What should exist from day one** (cheap now, expensive to retrofit):
- Vite + React + TS strict, with `dev`, `build`, `typecheck`, `lint` and `test` scripts, and the `@/` path alias.
- A lint rule that blocks `@supabase/supabase-js` outside `src/api/`, so principle 3 is enforced and not only written down.
- Router with all six routes plus a not-found page, each pointing to an empty view.
- Tailwind v4 + shadcn with one token layer, which niches override.
- i18n with sv/en, typed keys, and a test that both languages have the same keys.
- A `NicheConfig` type, a registry and one example niche, validated with Zod.
- A Supabase client in `src/api/`, env validated with Zod, and `.env.example`.
- Vitest with tests that check real rules.
- A `vercel.json` SPA rewrite, and a pinned Node version.

**Can wait:** DB schema, Edge Functions, realtime, modules, party screen, Playwright, AI, QR codes.

**Technical debt risks, ranked:**
1. Supabase access leaking out of `src/api/` unless lint enforces the boundary.
2. Drafts hidden only by the UI. "Only approved content is shown" must be enforced by RLS, not by a client-side filter.
3. The host has no identity that RLS can see. Reading drafts and admin data needs a deliberate design.
4. Realtime drift. Clients must subscribe, fetch a snapshot, and refetch on reconnect (for example a TV waking from sleep).
5. Env vars. Every `VITE_*` var ends up in the browser. Service-role and Anthropic keys must never have that prefix, and the repo is public.
6. Admin key in the query string. It is sent to the server, can end up in logs, and stays in browser history.
7. Zod schemas duplicated between the frontend and the Deno Edge Functions, drifting apart.
8. Niche logic or copy leaking into components or bypassing i18n.
9. Two parallel token systems (niche variables next to shadcn's).
10. Retention cleanup missing anonymous users in `auth.users`.
11. Hand-written DB types drifting from the schema.

**Gaps and contradictions found in `CLAUDE.md`:**
- A. Principle 3 ("Supabase only in `src/api/`") contradicts principle 5 ("each module has its own API functions").
- B. No place for hooks, layouts or the module registry in the folder structure.
- C. How the host reads drafts under RLS is not defined.
- D. UI language vs event language is not defined.
- E. The "fixed retention period" has no number.
- F. Package manager unclear: `.gitignore` mentions pnpm, `docs/workflow.md` says `npm ci`.
- G. Lint is required by the working agreement, but no linter is listed.
- H. Admin key placement in the host link.

It also listed the dependencies the foundation needs that `CLAUDE.md` doesn't mention (ESLint plugins, shadcn helpers, `@tailwindcss/vite`, Testing Library, and later a QR library and Playwright). These are to be approved in Step 2.

### My review

I reviewed the gaps (section 5 of the analysis) and decided:

| | Decision |
|---|---|
| A | All data access stays in `src/api/`, one file per module (`src/api/quiz.ts`, …). I asked what is standard. The agent explained layer-based vs feature-based (colocated) and recommended layer-based, because this project's main risks are about data access. I agreed. |
| B | Yes: add `src/hooks/`, `src/layouts/` and `src/modules/registry.ts`. |
| C | Deferred. I'm not sure yet. Decide before the first migration. |
| D | The UI follows the event's language by default. Every user can switch between Swedish and English. Host content stays in the event language. |
| E | Deferred until the cleanup function is built. |
| F | npm. |
| G | ESLint + Prettier. |
| H | The key that admins save stays, but it goes after `#` (`/host/:code#key=…`), so it never reaches the server. At first I didn't understand the question. The agent explained it's about where in the link the key sits, not whether to have a key. |

Decisions A, B, D, F, G and H were added to `docs/decisions.md`, and `CLAUDE.md` was updated where they change a rule.

**My comments:** _(fill in)_

### Open questions

- **C:** How does the host read drafts and admin data under RLS? Either every host read goes through an Edge Function, or the host signs in anonymously and the admin key binds that identity to the event.
- **E:** How long is event data kept before automatic deletion?

---

## Step 2: Plan

### Prompt

> Create a plan for building the foundation. Scope: project setup (Vite, React, TS strict, Tailwind v4, shadcn/ui, React Router), empty views for all routes in CLAUDE.md, src/api/ with a Supabase client, i18n with sv/en, one example niche configuration, theme tokens, and Vitest with a first test. No features, and no database schema beyond what the client needs to start. List which files are created or changed, what each step does, in what order, and how each step is verified. Do not implement anything. I want to see the plan first. Follow docs/decisions.md and the Step 1 analysis in implementation.md, and list every dependency not already in CLAUDE.md so I can approve it.

### What the agent produced

The full plan is in [`docs/plans/foundation.md`](docs/plans/foundation.md). In short:

- **8 steps, each with its own files and verification:**
  1. Scaffold
  2. ESLint + Prettier
  3. i18n + Vitest
  4. Tailwind + shadcn + tokens
  5. Niche config
  6. Routes, layouts and views
  7. `src/api/` Supabase client
  8. Docs and final check
- **Before planning, it checked the toolchain and current package versions.** It found that TypeScript 7.0 is out but typescript-eslint only supports TypeScript `<6.1`, so it pinned TypeScript ~6.0.3. Without that check, the scaffold would have pulled TS 7 and the lint setup would have failed.
- **A dependency table:** 17 packages that are not in `CLAUDE.md`, each with a reason. It also listed what it deliberately left out (language detector, Testing Library, jsdom, Tailwind Prettier plugin, state library, QR library, Playwright, Supabase CLI).
- **Several Step 1 risks became concrete guardrails:**
  - a lint rule that blocks Supabase outside `src/api/`
  - typed i18n keys plus a key-parity test
  - a niche schema that only allows existing shadcn tokens
  - env validation that rejects secret keys
  - a lazy Supabase client, so the app starts without `.env`
  - a `vercel.json` SPA rewrite
- **It flagged one step that combines two things itself:** Step 3 is i18n + Vitest, so that the first tests check real rules instead of `1 + 1`.
- **It listed what is deferred:** schema, RLS, Edge Functions, realtime, the module interface, `#key=` parsing, Playwright and CI.

## Step 3: Review of the plan

Approved as written, with no changes. I accepted the combined i18n + Vitest step based on the reason the agent gave. I approved the 17 extra dependencies.

Before implementation started, I asked why we couldn't use the newer TypeScript 7. The agent explained that TypeScript 7 is the same language with a faster compiler written in Go. It doesn't work yet with typescript-eslint's type-aware rules, which catch unhandled Supabase calls. The choice was TypeScript 7 without those rules, or TypeScript 6 and upgrade later. I chose to stay on 6. The decision is logged in `docs/decisions.md`.

**My comments:** _(fill in)_

## Step 4: Implementation, one step at a time

Each sub-step follows [`docs/plans/foundation.md`](docs/plans/foundation.md). Every one was started with this prompt:

> The plan is approved. Implement only step N. Then stop, run the verification for that step, and report the result before going further.

### 4.1 Scaffold Vite + React + TS strict

**What was done:**
- Generated the official `create-vite@9.2.1` react-ts template in a scratch folder and copied only the config files. These were **not** copied: the demo app, CSS, images, favicon, template README and `.oxlintrc.json`.
- Created:
  - `package.json`: name `mingle`, `engines.node >=22.22`, scripts `dev`, `build`, `preview`, `typecheck`.
  - `package-lock.json`.
  - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`.
  - `vite.config.ts`: React plugin plus the `@/` alias.
  - `index.html`: title "Mingle".
  - `src/main.tsx`: renders an empty root.
  - `.nvmrc` (`24`).
- Removed the pnpm lines from `.gitignore`.
- Installed `react` / `react-dom` 19.3, and as dev dependencies `vite` 8.3, `@vitejs/plugin-react` 6.1, `typescript` 6.0.3, `@types/react` / `@types/react-dom` 19.3 and `@types/node` 24.

**Found during the step:**
- The `create-vite` template now ships **Oxlint instead of ESLint**. It was not copied. ESLint comes in 4.2, as decided.
- The template already pins TypeScript ~6.0, which matches our decision.
- The template no longer sets `"strict": true`, because TypeScript 6 has it on by default. It is set explicitly anyway, per `CLAUDE.md` principle 10. `noUncheckedIndexedAccess` was also added.
- Small addition not in the plan: `<link rel="icon" href="data:,">`. With no favicon until the design exists, it avoids a 404 request on every page load.
- The files are written in Prettier's default style (double quotes, semicolons), so 4.2 won't reformat everything.

**Verification:**

| Check | Result |
|---|---|
| `npm ci` from a clean state (`node_modules` deleted) | ✅ 25 packages, 0 vulnerabilities |
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ 219.5 kB JS (68.6 kB gzip): React itself, with an empty page |
| Strict + alias demo: a temporary file imports through `@/` and reads `numbers[0]` as `number` | ✅ The `@/` import resolves, and typecheck fails with TS2322 (`number \| undefined`). It passes again once the files are removed |
| `npm run dev`, checked in the browser pane | ✅ Title "Mingle", entry script loads, no failed requests, no console errors, empty root |

**How to test manually:** run `npm ci` and then `npm run dev`, and open http://localhost:5173. You should see a blank page titled "Mingle", with no errors in the devtools console.

**Stopped or changed:** nothing.

**My comments:** _(fill in)_

---

## Deliverable summary

### What did the agent identify?

_(fill in at the end)_

### What did the agent want to do that I stopped, and why?

_(fill in at the end)_

### What did it miss?

_(fill in at the end)_

### Is the project runnable after the implementation?

_(fill in at the end)_
