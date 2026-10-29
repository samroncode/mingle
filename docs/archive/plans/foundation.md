# Plan: Foundation

**Status:** Approved 2026-10-15. Built one step at a time; progress is logged in [`implementation.md`](../implementation.md).

## Goal

Build the base of the app with no features and no database schema. When this plan is done, the app starts, every route in `CLAUDE.md` shows an empty page in Swedish and English, and typecheck, lint, tests and build all pass.

## Approach

Follows the Step 1 analysis in `implementation.md` and the 2026-10-15 entries in [`docs/decisions.md`](../../decisions.md). The foundation adds guardrails that are cheap now and expensive to retrofit: a lint rule that keeps Supabase inside `src/api/`, typed i18n keys, a niche config validated with Zod, one token layer, and env validation.

Environment when planned: Node 24.16, npm 11.13. Vite 8.3, React 19.3, React Router 8.4, Tailwind 4.3, Zod 4.6, i18next 26 / react-i18next 17, Vitest 5.0, ESLint 10, supabase-js 2.117.

**Version constraint:** TypeScript is pinned to ~6.0.3. TypeScript 7.0 is out, but typescript-eslint only supports `<6.1`.

### Dependencies

Approved together with this plan. These are not listed in `CLAUDE.md`:

| Package | Type | Why |
|---|---|---|
| `@vitejs/plugin-react` | dev | Vite's official React plugin |
| `@tailwindcss/vite` | dev | Tailwind v4's Vite plugin |
| `@types/react`, `@types/react-dom`, `@types/node` | dev | Type definitions |
| `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` | dev | Standard ESLint setup for Vite + React + TS |
| `eslint-config-prettier` | dev | Turns off ESLint rules that conflict with Prettier |
| `class-variance-authority`, `tw-animate-css`, `lucide-react` | runtime | Installed by `shadcn init` |
| `radix-ui` | runtime | Radix primitives, used by the shadcn Button (`Slot`) |
| `cn` | runtime | *Changed in Step 4:* shadcn 4's class-merging package, which replaced the planned `clsx` + `tailwind-merge` |
| `@fontsource-variable/geist` | runtime | *Added in Step 4:* the shadcn preset's self-hosted font |
| `shadcn` | dev | *Added in Step 4:* provides `shadcn/tailwind.css`, which `src/index.css` imports |

The three changes in Step 4 were approved during the step. They are recorded in `docs/decisions.md` (2026-10-15, shadcn/ui 4 setup), together with an `npm audit` finding that comes in through the shadcn CLI.

**Deliberately not added:** `i18next-browser-languagedetector` (our own small resolver implements the language rule), `jsdom` and `@testing-library/react` (only pure logic is tested so far), `prettier-plugin-tailwindcss`, state libraries, a QR library, Playwright and the Supabase CLI. Each needs a new approval when a feature calls for it.

## Steps

Each step ends with: checks pass → entry in `implementation.md` → one commit → push → wait for the owner's go-ahead.

**Standard check** (from Step 3 on): `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

1. **Scaffold Vite + React + TS strict.**
   - Copy only the config files from the official `create-vite` react-ts template; no demo app.
   - Strict TS plus `noUncheckedIndexedAccess`. `@/*` alias. `.nvmrc` 24, `engines.node >=22.22`.
   - Remove the pnpm lines from `.gitignore`.
   - *Verify:* `npm ci`, `typecheck`, `build`, and `npm run dev` with no console errors.
2. **ESLint + Prettier.**
   - typescript-eslint `recommendedTypeChecked`, react-hooks, react-refresh, `eslint-config-prettier`.
   - `no-restricted-imports` blocks `@supabase/supabase-js` and `@/api/client` outside `src/api/**`.
   - *Verify:* `lint` and `format:check` pass. A temporary forbidden import makes lint fail.
3. **i18n (sv/en) + Vitest.** Combined on purpose, so the first tests check real rules.
   - `src/i18n/` with i18next init, `sv.json`, `en.json` and typed keys.
   - `language.ts` resolves the language in this order: stored choice → event language → browser language → `en`.
   - Tests: key parity between sv and en, and the resolution order.
   - *Verify:* standard check. A missing key fails the test, and an unknown key fails typecheck.
4. **Tailwind v4 + shadcn/ui + theme tokens.**
   - `shadcn init` (Vite, neutral) and `shadcn add button`.
   - `src/index.css` is the only token layer.
   - *Verify:* standard check, and the tokens drive the page colors.
5. **Niche config + theme override.**
   - `src/niches/types.ts` (Zod schema; the theme may only override existing shadcn tokens; copy is i18n keys), `aw.ts`, `index.ts` registry with `NicheId`, `theme.ts`.
   - `src/components/NicheTheme.tsx`. `src/modules/registry.ts` with the module ids.
   - *Verify:* tests check that each niche passes the schema, overrides only known tokens, and has its i18n keys in sv and en.
6. **Routes, layouts and empty views.**
   - `src/router.tsx` (React Router 8) with every route from `CLAUDE.md`, plus not-found and a root error view.
   - Host, TV and Guest layouts. `LanguageSwitcher`. One empty view per route. `vercel.json` SPA rewrite.
   - The `#key=` fragment is not parsed yet.
   - *Verify:* every route works in the browser in both languages; the language choice persists after reload; a deep-link refresh works in `vite preview`.
7. **`src/api/` with the Supabase client.**
   - `env.ts` (Zod; rejects missing values, invalid URLs and `sb_secret_` keys).
   - A lazy `getSupabase()` in `client.ts`, so the app starts without `.env`.
   - A placeholder `database.types.ts`. `.env.example`.
   - *Verify:* env tests pass; the app runs without `.env`; importing `@/api/client` from a view fails lint.
8. **Docs and final check.**
   - Update the README (status, getting started), `docs/workflow.md` and `implementation.md`.
   - *Verify:* a clean `npm ci` plus every check. Then open one PR for the foundation.

## Not in this plan

DB schema, migrations and RLS; Edge Functions; realtime (subscribe → snapshot → refetch on reconnect); the module interface; party screen; parsing the `#key=` fragment; a `supabase gen types` script; Playwright; a CI workflow.

## Open questions

- **C:** How does the host read drafts and admin data under RLS? Decide before the first migration.
- **E:** How long is event data kept? Decide when the cleanup function is built.
