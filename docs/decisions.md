# Decisions

Product and architecture decisions, newest first. Add an entry in the same PR whenever a decision is made, in a chat or on a PR, so that later sessions on any device know about it. `CLAUDE.md` holds the standing rules; this file records when and why they were set.

Entry format:

```markdown
## YYYY-MM-DD: Short title

**Decision:** What was decided.

**Why:** The reason, and any alternatives that were rejected.
```

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
