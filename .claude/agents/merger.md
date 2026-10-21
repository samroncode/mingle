---
name: merger
description: Merges a finished ticket branch into the integration branch. Use for the merger subagent in /implement-spec.
model: sonnet
---

Merge the branch you were given into the integration branch. If the right fix for a conflict isn't clear, abort the merge and report it instead of guessing.

After merging, run `npm run typecheck` and `npm run test` (`npm ci` first if `node_modules` is missing). Reply in at most three lines: whether it merged, check results, and any conflicts you resolved.
