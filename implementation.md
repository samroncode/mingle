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

### 4.4 Tailwind v4 + shadcn/ui + theme tokens

**What was done:**
- Installed `tailwindcss` 4.3 and `@tailwindcss/vite`, added the plugin in `vite.config.ts`, and imported `src/index.css` from `src/main.tsx`.
- Ran `shadcn@4.21.5 init --template vite --base radix --preset nova`. It created:
  - `components.json` (style `radix-nova`).
  - `src/lib/utils.ts`.
  - `src/components/ui/button.tsx`. `init` already includes the Button, so the planned `shadcn add button` wasn't needed.
  - `src/index.css`: neutral tokens on `:root`, `.dark` overrides, `@theme inline`, and the base layer that sets `bg-background text-foreground`.
- Ran Prettier on the generated files. Added an ESLint exception for `src/components/ui/**`, because shadcn files export `buttonVariants` next to the component. The plan included this exception.

**The plan didn't match reality, and the agent stopped to ask:**
shadcn 4 changed after the plan was written. `init` now asks for a component library (its default is Base UI; the plan said Radix) and a style preset, and every preset brings a font. Instead of running it in the repo, the agent:
1. Read the CLI's options and preset definitions.
2. Did a **trial run in a scratch copy** of the project to see exactly what `init` would add.
3. Found three dependencies that weren't approved:
   - `cn`, which replaces the approved `clsx` + `tailwind-merge`.
   - `shadcn` itself, needed for `@import "shadcn/tailwind.css"`, which pulls in 271 packages.
   - `@fontsource-variable/geist`.
4. Checked that `cn` is legitimate (published by shadcn's own account, with no dependencies) before asking.
5. Stopped and asked me.

I chose: `shadcn` as a **dev** dependency, and keep the Geist font. Recorded in `docs/decisions.md`, with the dependency table updated in `docs/plans/foundation.md`.

**Found after installing:** `npm audit` went from 0 to **7 high-severity** findings. The agent traced all of them to one advisory (GHSA-vfj7-8cjw-p6xm, `braces` ≤3.0.3, a denial of service through deeply nested glob patterns) that comes in only through the shadcn CLI's `fast-glob`. No patched `braces` release exists. npm's suggested "fix", downgrading shadcn to 1.0.0, makes no sense. The finding is accepted as a dev-only risk and documented in `docs/decisions.md`. It's worth bringing up in the Part B security review.

**Verification:**

| Check | Result |
|---|---|
| `npm run typecheck`, `lint`, `test` (11), `format:check` | ✅ |
| `npm run build` | ✅ CSS 21.8 kB (4.7 kB gzip) plus the Geist `woff2` files. JS unchanged, since the Button isn't used yet |
| Browser: body colors | ✅ `background` = `--background` (`oklch(1 0 0)`), `color` = `--foreground` (`oklch(0.145 0 0)`) |
| Browser: override `--background` on `:root` | ✅ The body background changes. Removing the override restores it |
| Browser: font | ✅ `"Geist Variable", sans-serif`. No failed requests and no console errors |
| `npm audit` | ⚠️ 7 high, all from the advisory above (dev-only, accepted) |

**How to test manually:** open http://localhost:5173 in `npm run dev`. In devtools, change `--background` on `<html>` and check that the page background follows.

**Stopped or changed:** the agent stopped itself before adding dependencies that weren't approved, and asked. Two changes to the plan: `cn` replaced `clsx` + `tailwind-merge`, and `shadcn` and the Geist font were added. One planned step was dropped: `shadcn add button`, because `init` already created the Button.

**My comments:** _(fill in)_

### 4.5 Niche config + theme override

**What was done:**
- Installed `zod` 4.6. It is in the `CLAUDE.md` stack, and was already in `node_modules` through shadcn; now it's a direct dependency.
- `src/modules/registry.ts`: the module ids `quiz | awards | hottakes`. The shared module interface waits until the first module.
- `src/niches/types.ts`:
  - `themeTokens`, the shadcn tokens a niche may override.
  - `NicheConfigSchema` (Zod, strict). Its fields are `id`, `nameKey` / `descriptionKey` (i18n keys, never text), `theme` (only allowed tokens), `defaultModules` (only known module ids), and `promptHints` (English, for AI only).
- `src/niches/aw.ts`: the afterwork niche. Its theme values are placeholders until the design exists.
- `src/niches/index.ts`: the registry `niches`, the type `NicheId` derived from it, `getNiche()`, and `isNicheId()` for untrusted values such as an id read from the database.
- `src/niches/theme.ts`: `nicheThemeStyle()`, which turns tokens into CSS custom properties.
- `src/components/NicheTheme.tsx`: a wrapper that applies them and paints its own background and text, because `body` reads the `:root` tokens.
- `en.json` / `sv.json`: `niches.aw.name` and `niches.aw.description`.
- `src/niches/niches.test.ts`, with 9 tests:
  - the allowed tokens exist on `:root` in `src/index.css`
  - every niche passes the schema and is registered under its own id
  - its name and description exist in both languages
  - the schema rejects an unknown token or module
  - the CSS variable mapping
  - `isNicheId`

**Found during the step:** the first run of the token test failed, because Vitest returns CSS files as **empty strings**, even with `?raw`. The test failed for the right reason: it noticed it could see no tokens. The fix is `test.css.include` for `src/index.css` in `vite.config.ts`, so Vitest loads the real file.

**Verification:**

| Check | Result |
|---|---|
| `npm run typecheck`, `lint`, `format:check`, `build` | ✅ |
| `npm run test` | ✅ 3 files, 20 tests |
| Demo: add `"brand"` to the allowed tokens | ✅ The token test fails ("expected […] to include 'brand'"). Reverted |
| Demo: remove `niches.aw.description` from `sv.json` | ✅ Two tests fail: key parity, and "has its name and description in sv". Reverted |
| Browser: temporarily render an element with `bg-primary` inside and outside `<NicheTheme niche="aw">` | ✅ Inside: the afterwork primary `oklch(0.6 0.16 45)` and a 12px radius. Outside: the default `oklch(0.205 0 0)` and 10px, so the override doesn't leak. No console errors. `main.tsx` was reverted afterwards (empty diff) |

**How to test manually:** run `npm run test`. To see a niche theme, wrap something in `<NicheTheme niche="aw">` and check that `bg-primary` turns orange inside the wrapper only.

**Stopped or changed:** nothing stopped. Additions not in the plan:
- `isNicheId()`, so a niche id from the database can be validated later.
- Two negative schema tests.
- The Vitest `css.include` setting.

**My comments:** _(fill in)_

### 4.6 Routes, layouts and empty views

**What was done:**
- Installed `react-router` 8.4. It has the same data-router API as v7, and `RouterProvider` for the browser comes from `react-router/dom`.
- `src/router.tsx`: `createBrowserRouter` with every route from `CLAUDE.md`, grouped by layout. A root `errorElement` shows `ErrorView`, and `*` shows `NotFoundView`. The file exports only an `AppRouter` component, so the react-refresh lint rule stays happy.

  | Layout | Routes |
  |---|---|
  | Guest | `/`, `/p/:code`, `/p/:code/summary`, `*` |
  | Host | `/new`, `/host/:code` |
  | TV | `/tv/:code` |

- `src/layouts/GuestLayout.tsx`, `HostLayout.tsx`, `TvLayout.tsx`: small shells with `<Outlet />`, the language switcher, and a `data-layout` attribute that makes them easy to check.
- `src/components/LanguageSwitcher.tsx`: shadcn Buttons for sv and en. It stores the choice per device (`storeLanguage`), switches i18next, and sets `aria-pressed`.
- `src/components/EventCode.tsx`: shows `:code` from the route. Five views use it, so the param handling isn't repeated.
- Eight views in `src/views/`, each with a translated title. NotFound has a link to `/`, and Error has a reload button.
- New `common.code` and `views.*` keys in `en.json` / `sv.json`.
- `vercel.json`: SPA rewrite to `/index.html`.
- `src/main.tsx` renders `<AppRouter />`.

**Verification:**

| Check | Result |
|---|---|
| `npm run typecheck`, `lint`, `test` (20), `format:check`, `build` | ✅ Passed on the first run. JS 399 kB (128.8 kB gzip) with React Router |
| Browser: `/` | ✅ guest layout, "Mingle" |
| Browser: `/new` | ✅ host layout, "Create an event" |
| Browser: `/host/ABC123#key=demo-secret` | ✅ host layout, "Control panel", "Code: ABC123". The key stays in `location.hash` |
| Browser: `/tv/ABC123` | ✅ TV layout, "TV screen", "Code: ABC123" |
| Browser: `/p/ABC123` and `/p/ABC123/summary` | ✅ guest layout, "Join the party" / "Summary", with the code |
| Browser: `/does/not/exist` | ✅ guest layout, "Page not found", with a link to `/` |
| Language switch (real click on "Svenska" on the TV view) | ✅ "TV-skärm", "Kod: ABC123", `<html lang="sv">`, stored `sv`, `aria-pressed` updated. **Still Swedish after a reload.** Switching back to English works too |
| Error view demo: `SummaryView` temporarily throws | ✅ "Something went wrong" with a reload button instead of a blank screen. The demo line was removed afterwards |
| Production build: `npm run build && npm run preview`, then load `/tv/ABC123` and `/p/XYZ789/summary` directly | ✅ HTTP 200, the right view, no console errors |
| Console | ✅ No errors, except the expected ones from the error demo |

The Vercel rewrite itself can only be tested on the first preview deploy, and Vercel isn't connected yet.

**How to test manually:** run `npm run dev` and open `/`, `/new`, `/host/ABC123`, `/tv/ABC123`, `/p/ABC123`, `/p/ABC123/summary` and a made-up path. Click "Svenska", reload, and check that the page is still in Swedish.

**Stopped or changed:** nothing stopped. Small additions not in the plan:
- `EventCode`, to avoid repeating the param handling in five views.
- `data-layout` attributes.
- A home link on the not-found page and a reload button on the error page.

**My comments:** _(fill in)_

### 4.7 `src/api/` with the Supabase client

**What was done:**
- Installed `@supabase/supabase-js` 2.117.
- `src/api/env.ts`: `parseSupabaseEnv()` validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with Zod.
  - The URL must be http(s).
  - The key must not be empty, must not be a `sb_secret_…` key, and must not be a legacy JWT whose role is `service_role`.
  - Errors name every bad setting and point to `.env.example`.
- `src/api/client.ts`: `getSupabase()` creates **one** typed client on first use. Importing it never throws, so the app starts without `.env`.
- `src/api/database.types.ts`: an empty placeholder in the shape `supabase gen types` produces, to be replaced after the first migration.
- `.env.example`: the two variables, where to find them, and a warning that service-role/secret keys and the Anthropic key must never have a `VITE_` prefix.
- `vite.config.ts`: `unstubEnvs: true`, so env values stubbed in one test don't leak into the next.
- Tests: 10 new, 30 in total.
  - `src/api/env.test.ts` (7): a valid publishable key, a legacy anon key, missing settings (both named, with the hint), a bad URL including `javascript:`, a `sb_secret_` key, and a `service_role` JWT.
  - `src/api/client.test.ts` (3): imports without settings, fails on first use without settings, and returns one shared client.

**Verification:**

| Check | Result |
|---|---|
| `npm run typecheck`, `lint`, `format:check`, `build` | ✅ The bundle is byte-identical, because nothing imports the client yet |
| `npm run test` | ✅ 5 files, 30 tests, with no warnings in the output |
| Lint demo: a temporary view imports `@/api/client` **and** `../api/client` | ✅ 2 × `no-restricted-imports`. The relative path is blocked too, which Step 4.2 had not tested |
| Mutation demo: remove the `sb_secret_` check | ✅ "rejects a secret key" fails. Passes again once restored |
| `npm run dev` with **no `.env`** | ✅ `/p/ABC123`, `/tv/ABC123` and `/host/ABC123` render. No console errors in a fresh tab |
| Git: `.env.example` tracked, `.env` ignored | ✅ |

**Side note from verification:** the browser tool kept console messages from earlier pages in the same tab. Step 4.6's crash demo showed up again, so the agent opened a fresh tab to get a clean reading. Worth knowing when you read console output.

**How to test manually:** run `npm run test`. Copy `.env.example` to `.env` with your Supabase URL and publishable key. Nothing calls Supabase yet, so the first real check comes with the first feature that reads data.

**Stopped or changed:** nothing stopped. Additions not in the plan:
- The legacy `service_role` JWT check (many projects still use JWT keys).
- `http(s)`-only URLs.
- `client.test.ts`.
- `unstubEnvs`.

**My comments:** _(fill in)_

### 4.8 Docs and final check

**What was done:**
- `README.md`:
  - The status now says the foundation is in place but there are no features yet.
  - New "Getting started" section (Node 24, `npm ci`, copy `.env.example`, `npm run dev`) with a table of the npm scripts.
  - ESLint and Prettier added to the tech stack.
  - Link to this log.
- `docs/workflow.md`:
  - "Testing PRs" explains how to test until Vercel is connected.
  - "What is set up" lists the foundation and its checks.
  - Your remaining manual to-dos:
    - In the cloud environment, add the setup script `npm ci` and the two `VITE_SUPABASE_*` variables.
    - Connect Vercel (Vite, `npm run build`, `dist`).

**Final verification, from a clean state** (`node_modules` and `dist` deleted first):

| Check | Result |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ |
| `npm run test` | ✅ 5 files, 30 tests |
| `npm run build` | ✅ JS 399.3 kB (128.8 kB gzip), CSS 23.8 kB (5.1 kB gzip) |
| Dev smoke test of `/`, `/new`, `/host/ABC123`, `/tv/ABC123`, `/p/ABC123`, `/p/ABC123/summary` and `/nope`, in a fresh tab | ✅ Each shows the right view, layout and code. No console errors |
| `npm audit` | ⚠️ 7 high, all from the known `braces` advisory via the shadcn CLI (see 4.4 and `docs/decisions.md`) |

**How to test manually:** follow "Getting started" in the README, then click through the routes listed above.

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
