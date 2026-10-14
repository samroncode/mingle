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
2. Describe the task. For anything larger, ask for a plan first; it is written to `docs/plans/`.
3. Claude works on a branch, pushes it and opens a PR.
4. Review the diff in the app or on GitHub. Leave comments in the session or on the PR.
5. Merge on GitHub with **Squash and merge**.
6. Back at the desk, start new work from the latest `main`. Local sessions pull first.

## Testing PRs

For now, review the diff and the "How to test" section of the PR.

Once the app is scaffolded and connected to Vercel, every PR gets a preview deployment with its own URL, so a PR can be tried on the phone before it is merged.

## Keeping things together

- **One session per task.** When the PR is merged, archive the session.
- **Decisions go in the repo.** If something is decided in a chat, make sure it ends up in `docs/decisions.md` (or `CLAUDE.md` if it changes a rule).
- **Ideas go in `IDEAS.md`**, not into the current task.

## What is set up

- Claude GitHub App installed on `samroncode/mingle`, so cloud sessions can push branches and open PRs.
- A cloud environment named "Default" on claude.ai/code.
- Desktop app: new sessions connect to Remote Control.
- GitHub CLI (`gh`) signed in on the desktop, so local sessions can open PRs.

To do once the app is scaffolded: add a setup script (`npm ci`) and the Supabase variables to the cloud environment, and connect the repo to Vercel for preview deployments.
