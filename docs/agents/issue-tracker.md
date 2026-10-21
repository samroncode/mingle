# Issue tracker: GitHub

Specs and tickets for this repo are GitHub issues. Use the `gh` CLI; it infers the repo from `git remote -v`.

- **Create**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List**: `gh issue list --state open --json number,title,body,labels`.
- **Sub-issue** (a ticket under its spec): `gh issue create --parent <spec> ...`, or `gh issue edit <spec> --add-sub-issue <ticket>` (`gh` 2.94+). Otherwise put `Part of #<spec>` at the top of the ticket body.
- **Blocking**: `gh api --method POST repos/samroncode/mingle/issues/<ticket>/dependencies/blocked_by -F issue_id=<blocker-id>`, where `<blocker-id>` is `gh api repos/samroncode/mingle/issues/<n> --jq .id` (not the `#number`). If that fails, put `Blocked by: #<n>, #<n>` at the top of the ticket body.
- **Comment**: `gh issue comment <number> --body "..."`
- **Close**: `gh issue close <number> --comment "..."`

GitHub shares one number space across issues and PRs, so `#42` may be either: try `gh pr view 42`, then `gh issue view 42`.

## Mingle conventions

- No triage labels. Skip any step that applies one, such as `ready-for-agent`.
- A spec is one issue and its tickets are sub-issues. The PR that builds a spec closes the spec and its tickets (`Closes #<n>` lines).
- During `/implement-spec`, work out which tickets are unblocked from what has merged into the integration branch. GitHub's blocked-by count only drops when issues close, which happens at the end.
