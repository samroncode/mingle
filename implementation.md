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

### 4.2 ESLint + Prettier, with the `src/api/` guardrail

**What was done:**
- Installed dev dependencies:
  - `eslint` 10.12, `@eslint/js` 10, `typescript-eslint` 8.71
  - `eslint-plugin-react-hooks` 7.1, `eslint-plugin-react-refresh` 0.5, `globals` 17
  - `prettier` 3.9, `eslint-config-prettier` 10.1
  - No peer-dependency conflicts.
- `eslint.config.js` (flat config) for `*.ts` / `*.tsx`:
  - JS recommended, typescript-eslint `recommendedTypeChecked` (project service), the react-hooks flat recommended config and the react-refresh Vite config, with `eslint-config-prettier` last.
  - **Guardrail:** `no-restricted-imports` blocks `@supabase/*` and `@/api/client` (or any `…/api/client`) in every file outside `src/api/**`. The error message points to `CLAUDE.md` principle 3.
- `.prettierrc.json` (`{}`, Prettier defaults) and `.prettierignore`.
- Scripts `lint`, `format` and `format:check`.

**Not in the plan, added in this step:**
- **`.gitattributes` with `* text=auto eol=lf`.** Committing Step 4.1 showed that Git on Windows checks files out with CRLF line endings. Prettier expects LF, so `format:check` would have failed on the desktop. After `git add --renormalize .`, no committed file changed, because the repo already stored LF.
- **Markdown is excluded from Prettier.** A dry run showed that the only files Prettier would change were the 9 Markdown docs, mostly by re-padding tables (including `CLAUDE.md`). All code files already passed. Excluding `*.md` keeps the docs as written, and keeps edits from the phone easy to review. This can be reversed later with a one-time `npm run format`.

**Verification:**

| Check | Result |
|---|---|
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ All matched files use Prettier code style |
| `npm run typecheck`, `npm run build` | ✅ Unchanged from 4.1 |
| Guardrail demo: a temporary file outside `src/api/` imports `@supabase/supabase-js` and `@/api/client` | ✅ 2 × `no-restricted-imports` errors, with the principle 3 message |
| Allowed case: the same Supabase import in a temporary file inside `src/api/` | ✅ No error |
| Type-aware rule demo: a temporary file calls a promise-returning function without `await` | ✅ `@typescript-eslint/no-floating-promises` error. This is the rule we kept by staying on TypeScript 6 |
| Lint after the demo files were removed | ✅ |

**How to test manually:** add `import { createClient } from "@supabase/supabase-js";` at the top of `src/main.tsx` and run `npm run lint`. It should fail with the "only accessed inside src/api/" message. Remove the line again.

**Stopped or changed:** nothing stopped. The agent made the two additions listed above. It flagged `.gitattributes` at the end of 4.1, before this step started. It made the Markdown exclusion during the step and explained it in this entry.

**My comments:** _(fill in)_

### 4.3 i18n (sv/en) + Vitest

**What was done:**
- Installed `i18next` 26.4 and `react-i18next` 17.0, and `vitest` 5.0 as a dev dependency.
- Created in `src/i18n/`:
  - `en.json` / `sv.json`: starter keys (`app.name`, plus the `language.*` labels the language switcher will use in 4.6).
  - `language.ts`:
    - `resolveLanguage()` picks the language in the order from decision D: the user's stored choice → the event's language → the first supported browser language → English.
    - `loadStoredLanguage()` / `storeLanguage()` wrap localStorage, so blocked storage doesn't crash the app.
  - `index.ts`: initializes i18next with the resolved language and keeps `<html lang>` in sync. It is imported from `src/main.tsx`.
  - `i18next.d.ts`: types every key from `en.json`, so `t("unknown.key")` fails typecheck.
- Vitest is configured in `vite.config.ts` (node environment, stubbed globals reset after each test). Added the scripts `test` (`vitest run`) and `test:watch`.
- Tests: 11 in total.
  - `locales.test.ts`: sv and en have the same keys, and every value is a non-empty string.
  - `language.test.ts`: the resolution order, unsupported values ignored, the localStorage round trip, and blocked storage.

**Verification:**

| Check | Result |
|---|---|
| `npm run typecheck`, `lint`, `format:check`, `build` | ✅ The JS bundle grew from 219.5 to 264.9 kB (82.9 kB gzip) with i18next |
| `npm run test` | ✅ 2 files, 11 tests |
| Demo: remove `language.label` from `sv.json` | ✅ The key-parity test fails and names the missing key. Passes again after it is restored |
| Demo: a temporary file calls `i18n.t("does.not.exist")` next to `i18n.t("language.label")` | ✅ Typecheck fails only on the unknown key (TS2345) |
| Browser, nothing stored (browser languages `en-GB`, `en-SE`) | ✅ `<html lang="en">` |
| Browser, `mingle.language = "sv"` in localStorage, then reload | ✅ `<html lang="sv">`. The stored choice wins over the browser. No console errors |

**Problem found and fixed during the step:** the first try at the missing-key demo used a PowerShell script to edit `sv.json`. Windows PowerShell 5.1 read the UTF-8 file with the wrong encoding, so the line was never removed and the test stayed green. Worse, restoring the file turned "Språk" into "SprÃ¥k". The agent noticed both problems before committing, rewrote the file correctly, searched the repo for other broken characters (none), and redid the demo with the editor tool, where it failed as expected. Lesson: don't let PowerShell 5.1 rewrite UTF-8 files. Note that the tests would not have caught the broken character on their own, because the text was still a non-empty string.

**How to test manually:** run `npm run test`. For the language: open http://localhost:5173 in `npm run dev`, run `localStorage.setItem("mingle.language", "sv")` in the console, reload, and check that `<html lang="sv">`.

**Stopped or changed:** nothing stopped. No changes to the plan.

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
