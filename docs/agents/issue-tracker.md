# Issue tracker: GitHub

Specs and tickets for this repo are GitHub issues. Use `gh api` (REST) for everything. Cloud sessions block GitHub's GraphQL API, which `gh issue` and `gh pr` depend on.

- **Create**: write the body to a temp file, then `gh api repos/samroncode/mingle/issues -f title="..." -F body=@body.md --jq '{number, id}'`.
- **Read**: `gh api repos/samroncode/mingle/issues/<n> --jq '{number, title, body, state}'`. Comments: `gh api repos/samroncode/mingle/issues/<n>/comments --jq '.[].body'`.
- **List open**: `gh api "repos/samroncode/mingle/issues?state=open&per_page=100" --jq '.[] | select(.pull_request | not) | {number, title}'`. The endpoint also returns PRs, which the filter drops.
- **Sub-issue** (a ticket under its spec): `gh api --method POST repos/samroncode/mingle/issues/<spec>/sub_issues -F sub_issue_id=<ticket-id>`.
- **Blocking**: `gh api --method POST repos/samroncode/mingle/issues/<ticket>/dependencies/blocked_by -F issue_id=<blocker-id>`. If that fails, put `Blocked by: #<n>, #<n>` at the top of the ticket body.
- **Comment**: `gh api repos/samroncode/mingle/issues/<n>/comments -f body="..."`
- **Close**: `gh api --method PATCH repos/samroncode/mingle/issues/<n> -f state=closed`
- **Pull request**: `gh api repos/samroncode/mingle/pulls -f title="..." -f head=<branch> -f base=main -F body=@body.md -F draft=true`. To mark it ready, use `gh api --method POST repos/samroncode/mingle/pulls/<n>/ccr/ready_for_review` in a cloud session, or `gh pr ready <n>` on the desktop.

`<…-id>` is the numeric `id` from the create or read call, not the `#number`. Issues and PRs share one number space, so `#42` may be either; `gh api repos/samroncode/mingle/pulls/42` tells you.

## Mingle conventions

- No triage labels. Skip any step that applies one, such as `ready-for-agent`.
- A spec is one issue and its tickets are sub-issues. The PR that builds a spec closes the spec and its tickets (`Closes #<n>` lines).
- During `/implement-spec`, work out which tickets are unblocked from what has merged into the integration branch. GitHub's blocked-by count only drops when issues close, which happens at the end.
