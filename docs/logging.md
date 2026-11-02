# Logging and error handling

Rule (CLAUDE.md principle 11): every feature handles and logs its errors. Mingle works without any paid service, so everything below is free and lives in Supabase.

## Where to read errors

| Where | What | How to read |
|---|---|---|
| `client_errors` table | Errors from guests' phones, the host and the TV | Supabase dashboard, Table editor or SQL. Rows older than 14 days are deleted nightly. |
| Edge Functions, host-actions, Logs | One JSON line per request: `action`, `event` (code), `result` (`ok` or error code), `ms`; plus `thrown` (error name) when it crashed. A failure inside an action adds a `failure: true` line with a fixed description and database error code | Supabase dashboard, Edge Functions. Short retention. |
| Database and API logs | Blocked queries, slow queries | Supabase dashboard, Logs. |

Nothing is logged for a phone with no signal at all; nothing reaches us.

## What a feature must do

1. List the failures a user can hit (network, refused by RLS, bad input, an external app that does not open).
2. Show a visible, translated message with a way to retry. Never fail silently.
3. Log it: in the browser call `logError` (src/api); in an Edge Function use the structured log line.
4. Log codes only: area, action, error code. Never guest names, amounts, phone numbers, Swish numbers, the admin key, or the URL after `#`.
5. Logging must never throw or change what the user sees.
6. Add tests for the error path.

Specs get an "Errors and logging" section and every ticket an acceptance criterion for it.
