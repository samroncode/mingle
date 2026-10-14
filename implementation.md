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

_(to be added)_

## Step 3: Review of the plan

_(to be added)_

## Step 4: Implementation, one step at a time

_(to be added)_

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
