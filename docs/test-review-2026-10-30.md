# Unit test review, 2026-10-30

Scope: the 742 Vitest unit tests (68 files in `src/` plus `supabase/functions/host-actions/flow.test.ts`). The `*.db.test.ts` and Playwright tests were checked only for overlap, not trimmed.

## Short answer

The count is inflated more by how tests are *counted* than by duplicates. Two files produce 194 of the 742: `theme.test.ts` (104, one test per colour pair per theme) and `niches.test.ts` (90, one per niche per language per content check). Real duplicates are few, because most files test one small pure function, and the three modules (quiz, awards, hot takes) are deliberately twins.

## Done in this PR: 742 -> 638 (-104)

| Area | Change | Tests | Why it is safe |
|---|---|---|---|
| `app/theme.test.ts` | The 31 per-pair `it.each` cases per theme become one test per theme that lists every failing pair | -90 | Same 31 pairs are still checked for all 3 themes; a failure now names all bad pairs at once |
| `lib/wizard/hottakes.test.ts`, `awards.test.ts` | Removed "keeps the first pick when seeded again" and "unticks, ticks, reorders and adds" | -4 | These exercise the shared pick-list reducer, already covered by `pick-list.test.ts`. The 20-item limit, niche picking, language copy and validation tests stay |
| `lib/wizard/quiz.test.ts` | Removed "removes and adds back", "does not add twice", "moves a question" | -3 | Same shared reducer, covered by `pick-list.test.ts`. Seed, own-question editing, 30 limit stay |
| `niches/niches.test.ts` | Removed "maps each niche onto its theme" (restates config), "starts with shared costs off" (x3, restates a constant), "has English prompt hints" (x3, ASCII regex on AI-only text) | -7 | Pure restatement of config values; schema and token checks stay |

## Kept on purpose (no change)

- **Security, join and auth**: `api/session`, `host/admin-key`, `host/host-door`, `api/errors`, `api/host-actions`, `guest/guest-page`, `host-actions/flow`, all `*.db.test.ts`. No overlap found between unit and db tests: unit tests cover UI mapping and parsing, db tests cover policies and RPCs.
- **Money (shared costs, Swish)**: `schemas/costs`, `costs/shares`, `costs/payments`, `costs/costs-form`, `guest/swish`, `guest/bill`, `wizard/state-costs`. Some repetition between `schemas/costs` and `costs-form` (both reject bad price and number) but they guard two layers (server schema vs form errors). Not touched.
- **The three module twins** (`modules/*/screen.test`, `wizard/state-{quiz,awards,hottakes}`, `host/{quiz,awards,hottakes}-edit`, `schemas/{awards,hottakes}`): look alike but each guards its own wiring and limits. Merging them into shared parametrised tests would remove ~25 more tests but make failures harder to read and add test infrastructure; not recommended now.
- **Compatibility tests** ("restores a draft saved before the step existed", "ignores a draft with more than N"): cheap and protect real users' saved drafts.

## Candidates left for Sam to decide (not removed)

| Test(s) | Count | Lean | Reasoning |
|---|---|---|---|
| `niches.test.ts` content checks split per niche x language (quiz, awards, hot takes) | ~60 | Keep | Each guards built-in Swedish/English content; could be folded into one test per niche (-40) with no loss, but failures read worse. Easy follow-up if the count still bothers you |
| `vercel-config.test.ts` | 13 | Keep | Asserts security headers and SPA rewrite; cheap |
| `api/client.test.ts` "returns one shared client" | 1 | Remove if wanted | Trivial identity check; the other two client tests guard real behaviour |
| `partyscreen/rotation.test.ts` (11) vs `parts.test.ts` | 11 | Keep | Timer and part-removal logic has real edge cases |
| `components/*.test.tsx` (FunZone, PanelSection, ItemProgress, NicheTheme) | 11 | Keep | Small, behavioural (aria, nesting, reduced motion) |
| Unit vs e2e overlap (`e2e/guest-bill`, `host-costs`, `quiz-run`, ...) | n/a | Keep | e2e covers flows through the UI with Supabase faked; unit tests cover pure logic. Different layers |

## How the count could go lower later

Folding the per-niche/per-language content checks (~-40) and the twin module tests (~-25) would reach about 570, but both trade failure-message clarity for a smaller number. Quality did not improve from either, so they are left out.
