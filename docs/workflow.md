# Workflow

How Mingle is worked on across the desktop and the phone. The rules Claude follows are in the "Git and PR workflow" section of `CLAUDE.md`; this page is the human side of the same flow.

## Where to work

| Situation | Use | Notes |
|---|---|---|
| At the desk | Claude Code in the Desktop app, local session | Full access to the local checkout. Sessions connect to Remote Control automatically. |
| Away, desktop still running | Remote Control, from the Code tab in the Claude app | Continues the same local session. Goes offline when the desktop sleeps or the app closes. |
| Away, desktop off | Cloud session, from the Code tab in the Claude app | Runs on Anthropic's infrastructure and clones `samroncode/mingle` from GitHub. Sees only what is pushed. |

GitHub connects all three. Every task ends as a PR, and `main` only changes when a PR is merged.

## A task from the phone

1. In the Claude app, open **Code** and start a new session on `samroncode/mingle`.
2. Describe the task. For anything larger, run `/grill-with-docs`, then `/to-spec` and `/to-tickets`; the spec and its tickets become GitHub issues. Build them with `/implement-spec`. A spec that touches the database is built at the desk (see "Database work").
3. Claude works on a branch, pushes it and opens a PR.
4. Review the diff in the app or on GitHub. Leave comments in the session or on the PR.
5. Merge on GitHub with **Squash and merge**.
6. Back at the desk, start new work from the latest `main`. Local sessions pull first.

## Testing PRs

Every PR gets a Vercel preview deployment with its own address, backed by the **staging** Supabase project, so a PR can be tried on the phone before it is merged. Open it from the PR's checks or the Vercel comment.

If the PR changes `supabase/` (migrations or functions), the preview only works once its backend is on staging:

1. GitHub → Actions → **Staging** → Run workflow, choose the PR's branch and leave **reset** unticked.
2. When you are done, run **Staging** again with **reset** ticked. That wipes staging data and puts it back to `main`.

Live is never touched by a PR. It only changes when the owner merges and the **Deploy** workflow runs. See [`hosting.md`](hosting.md).

## Database work

Database code needs the local Supabase stack, which runs in Docker on the desktop. Setup and commands are in [`supabase.md`](supabase.md).

- **Plan from anywhere.** `/grill-with-docs`, `/to-spec` and `/to-tickets` need no Docker, so they work from the phone.
- **Build at the desk.** Start `/implement-spec` in a local desktop session, with Docker Desktop running and the session in Auto mode.

## Keeping things together

- **One session per task.** When the PR is merged, archive the session.
- **Decisions go in the repo.** If something is decided in a chat, make sure it ends up in `docs/decisions.md` (or `CLAUDE.md` if it changes a rule).
- **Ideas go in `docs/IDEAS.md`**, not into the current task.
- **Opus in the main session** (`/model opus`). It plans with you and orchestrates; the subagents pick cheaper models themselves.

## What is set up

- Claude GitHub App installed on `samroncode/mingle`, so cloud sessions can push branches and open PRs.
- A cloud environment named "Default" on claude.ai/code.
- Desktop app: new sessions connect to Remote Control.
- GitHub CLI (`gh`) signed in on the desktop, so local sessions can open PRs.
- Agent skills copied from [mattpocock/skills](https://github.com/mattpocock/skills) into `.claude/skills/`. To update them, copy the folders again and redo the mingle edits listed in `docs/decisions.md` (2026-10-21).
- `.claude/settings.json` pre-approves the routine check, database and git commands, and always asks before a command touches the hosted Supabase project.
- The app foundation (see `docs/plans/foundation.md`). `npm ci` installs everything. The checks are `npm run typecheck`, `npm run typecheck:functions`, `npm run lint`, `npm run test` and `npm run build`.

Still to do by the repo owner:

- On the desktop, install a working Docker Desktop (see [`supabase.md`](supabase.md)) before the backend core is built.
- In the cloud environment, add the setup script `npm ci` and the variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Put Mingle online by following the launch checklist in [`hosting.md`](hosting.md). Until you set the repository variable `HOSTING_ENABLED=true` (step 5 there), the Deploy and Keep awake workflows are skipped on purpose.
