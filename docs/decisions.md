# Decisions

Product and architecture decisions, newest first. Add an entry in the same PR whenever a decision is made, in a chat or on a PR, so that later sessions on any device know about it. `CLAUDE.md` holds the standing rules; this file records when and why they were set.

Entry format:

```markdown
## YYYY-MM-DD: Short title

**Decision:** What was decided.

**Why:** The reason, and any alternatives that were rejected.
```

## 2026-10-22: Three more root files move into their folders

**Decision:** `tsconfig.app.json` moved to `src/tsconfig.json`, `tsconfig.db.json` to `supabase/tests/tsconfig.json`, and `playwright.config.ts` to `e2e/playwright.config.ts` (`npm run test:e2e` passes `-c`). This updates the 2026-10-21 entry "Loose docs live in docs/": the root keeps `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` and the other tool config. The README has a "What's where" section.

**Why:** TypeScript project references, ESLint's project service and Playwright's `-c` flag all accept a config in a subfolder with no custom tool setup, so the root gets shorter at no cost. The tools that need their config at the root still have it there.

## 2026-10-22: Guests answer the quiz (#55)

**Decision:**

- `quiz_answers` holds one row per guest and question (chosen option 0-3, updated time). It is deleted with the question, the event and the guest's membership. A guest inserts and updates only their own row, only while the event is live with the quiz on that question's position and the phase `open`; a `security definer` helper (`can_answer_quiz_question`) holds that rule for both policies. Column grants keep question, event and user fixed on update, and nobody deletes through the API. A guest reads their own rows, the host reads all of their event, the TV and non-members read none.
- The question's `answer_count` is raised by a `security definer` trigger on insert, so changing an answer doesn't count twice. Members read it through the question row. It is not lowered when an answer is deleted with a removed guest; the guest-removal ticket decides how to handle that.
- `quiz_votes(question_id)` returns the votes per option (always four rows) only for a member of the event and only once the question is revealed; otherwise no rows, so a non-member learns nothing.
- The data layer saves an answer by trying an update and then an insert. An RLS refusal (`42501`) becomes the error code `question_closed`, shown as "Too late, the answer is revealed."
- Views follow answers live through a quiz channel on `quiz_questions` and `quiz_answers` (`subscribeToQuizChanges`), refetching at most once per 300 ms. Realtime doesn't send an answer's chosen option to anyone but the host and the guest themselves, because it applies the same RLS.
- The phone says "Right! +1" or "The answer was B". The score so far is left to the scores ticket.

**Why:** Putting the "open on this question" rule in one function keeps the insert and update policies identical, and a test per refusal makes removing either one fail. A composite foreign key from the answer to its question and event means the database itself keeps an answer's event the same as its question's. Counting with a trigger lets the TV show "7 of 12 answered" without any client reading answers.

## 2026-10-22: How the host runs the quiz (#54)

**Decision:** A question is played once it is revealed; a database trigger sets `revealed_at` in the same write as the flow change. The quiz starts at the first unplayed question, answers `module_empty` with no questions and `module_finished` when all are played. After the last question `next_step` moves to a results step (step = number of questions), where only `stop_module` works. `host-actions` reads per-activity step bounds from `step-bounds.ts` before the flow write. Edge Function unit tests (`supabase/functions/**/*.test.ts`) now run in the unit project.

**Why:** The reveal must never leave a question unmarked, and a finished quiz must stay finished. Step bounds are read outside the flow write's transaction, so `update_quiz` (later ticket) must keep that in mind.

## 2026-10-22: Quiz questions in the event and the wizard (#53)

**Decision:**
- Quiz questions live in `quiz_questions` (position from 0, text, four options, `draft`/`approved`, revealed time, answer count) and the right options in `quiz_answer_keys`, deleted with their question. Clients only read them: the host reads all of an event's questions and keys, other members read an approved question only while the quiz shows it (that position, phase open or revealed) or after it was revealed, and a key only after its reveal. Drafts are never shown to guests or the TV.
- `create_event` takes an optional `quiz` list and stores the questions and keys in the same transaction as the event. The RPC got a new `quiz` argument, so the migration drops the old signature and creates the new one. Questions with the quiz switched off, more than 30, or an invalid question answer `invalid_request`; an empty list is fine either way.
- The wizard's quiz step lists the picked questions (move, remove) with the niche's other ready-made questions to add below, plus a form for the host's own questions. The draft keeps built-in ids, so they follow the event language. Changing the niche drops the old niche's ready-made picks and keeps the host's own questions; the random pick of ten is made again when the step is next reached. An unfinished own question blocks Next and Create, which sends the host back to the step.
- The module definition's optional `WizardStep` now gets the draft and a dispatch function, so the quiz step itself lives in `src/modules/quiz/wizard/`. The generic wizard still knows the quiz exists, to show the step only when the quiz is on, validate it and send its questions; later activities with a wizard step will generalise that.
- Until the control panel spec, the panel loads the event after claiming the host link and shows each switched-on activity's section. The quiz section lists the questions with the right answer marked, read-only and loaded once.

**Why:** Keeping keys in their own table makes "no peeking before the reveal" a plain row rule. Storing built-in ids in the draft, not text, means switching language never leaves a question in the wrong language. Keeping the host's own questions on a niche change loses no typed work; keeping the old niche's picks would mix in questions that no longer exist.

## 2026-10-22: How Mingle runs online (#88)

**Decision:**
- The app runs on Vercel's free Hobby plan at a free `*.vercel.app` address named "mingle" (or the closest free variant). Host links, the TV address and QR codes come from the page's own origin, so the name is not in the code. A custom domain can come later; the old address then redirects so saved host links keep working.
- There are two Supabase projects: **live** (the existing one, only for real parties) and **staging** (a second free project). Every PR's preview link talks to staging.
- A merge to `main` deploys through a GitHub Actions workflow: migrations and Edge Functions to live, then to staging, and only then a Vercel deploy hook publishes the app. Vercel's own automatic production deploy is off. If the backend step fails, live keeps the old app. Manual workflow buttons put a branch on staging and reset staging to `main`. A daily job keeps both projects awake.
- Agents still never deploy by hand. The owner's merge is the go-ahead for the deploy workflow.
- Required CI checks on PRs are not part of this; the owner will reconsider them later.

**Why:** Vercel and Supabase free plans cost nothing at Mingle's scale. Staging lets a database PR be tried for real on the phone and keeps test data out of real parties; using live for previews was rejected for both reasons. Deploying from a workflow puts the database change before the app code that needs it, so a merge can't break a running party while the owner is away from the desk; deploying by hand was rejected for that gap. Free projects sleep after a quiet week, which would take the live app offline.

## 2026-10-22: Turnstile on every live sign-in, and a higher per-address limit (#88)

**Decision:**
- On live, every anonymous sign-in passes Cloudflare Turnstile in invisible/managed mode. The widget only exists when `VITE_TURNSTILE_SITE_KEY` is set, so staging, the local stack and the tests have none. It's loaded from Cloudflare's script, with no new npm dependency.
- Sign-in happens in one place, so every page and the silent re-sign-in after cleanup are covered. A failed check shows a retry message (`captcha_failed`).
- Live's anonymous sign-ins per internet address go up to 300 an hour.
- Turnstile is a security check, not tracking or analytics, so it fits the "no analytics or tracking" rule.

**Why:** Guests at a party share one wifi and so one internet address, and Supabase's default of about 30 sign-ins an hour per address would lock out guest 31. The limit can only be raised safely once bots are stopped another way, which is what the CAPTCHA (decided 2026-10-21) does.

## 2026-10-22: Preview addresses are allowed on staging by a narrow wildcard (#88)

**Decision:** `ALLOWED_ORIGINS` keeps exact matches and accepts one wildcard form: a single `*` inside the first host label, such as `https://mingle-*-samroncode.vercel.app`. The `*` matches letters, digits and hyphens only, never a dot. A bare `*` is refused. Live uses exact addresses only.

**Why:** Each preview link has its own address, so exact matches can't list them. Ending in the owner's Vercel team name means other people's Vercel sites don't match. Allowing any origin on staging was rejected because the same code runs on live, where a mistyped secret must not open it up.

## 2026-10-22: Security headers on every page (#88)

**Decision:** `vercel.json` sets a Content Security Policy that allows only the app, Supabase and Turnstile, forbids framing by other sites, and sends no referrer, plus `nosniff` and a Permissions-Policy that turns off camera, microphone and location.

**Why:** It costs nothing and limits the damage of any script injection. The admin key is already safe in the URL fragment; `no-referrer` is a second guard.

## 2026-10-22: How expired events are cleaned up (#83)

**Decision:**
- When an event's 30 days are up, cleanup deletes all of it: the event, its members and their display names, its admin key hash, and every quiz, award and hot take row. Nothing is kept, not even counts.
- The same run deletes the event's rate-limit counters and any counter whose window started more than a day ago, and anonymous logins that belong to no event and haven't signed in or refreshed a session for 30 days.
- Every foreign key to `public.events` is `on delete cascade`. A catalog test fails if one isn't, so tables added by later specs are covered.
- Cleanup is one server-only database function, `private.cleanup_expired()`, run in one transaction by `pg_cron` every night at 03:00 UTC. It returns how many rows it deleted, which the run history in the Supabase dashboard shows. No client role can run it. There is no `cleanup` Edge Function.
- Codes of deleted events go into the server-only `private.retired_codes` (code only) and `create_event` treats them as taken, so a code is never reused.
- A deleted event looks like an unknown code: guest, TV, summary and host pages reuse their existing "wrong code or expired" notes and error codes. A phone whose login was removed signs in again without an error.
- No backups or undo.
- Everything is database-only or frontend-only, so it can be built in a cloud session, at any time.

**Why:** Deleting everything keeps the 30-day promise and stores no personal data longer than needed. pg_cron is free on Supabase, runs inside the database without a secret key or HTTP call, and can be tested with the database tests, which an Edge Function couldn't in a cloud session. A nightly run is enough because expired events are already hidden the moment they expire. Never reusing a code costs one tiny table and rules out an old QR code or TV address landing in a stranger's party. Removing unused anonymous logins stops `auth.users` from growing forever (`docs/implementation.md`, item 10). A separate "this event was deleted" note was rejected: an unknown and a deleted code would need to be told apart, which adds a check for no gain.

## 2026-10-22: What the control panel covers, and how removing a guest works (#75)

**Decision:**
- The control panel spec builds the panel around the activities: one scrolling page with a top bar (code, guest count, what the TV shows now, Stop), the activity sections that each activity's spec builds, and sections for the party screen, the guests and the event. Running and editing activity content stay in the quiz, awards and hot takes specs. The summary page and AI are left out.
- Only one activity runs at a time; while one runs, the others' Start buttons are greyed out with a reason.
- The host can switch activities on and off during the evening. Turning one on gives it the wizard's random pick, saved with that activity's own update action. The running activity can't be turned off; a finished one can, and its results are kept. A new `set_modules` action saves the list.
- The party screen is edited with the wizard's fields and saved with the existing `update_party_content`; it works while an activity runs. Ending the evening uses the existing `end_event` move behind a confirm.
- The host sees a live guest list A to Z and can rename a guest (same rules as joining; answers and votes stay theirs) or remove them after a confirm. There is no undo.
- A removed guest keeps their row with a removed time and counts as no membership, so RLS gives them nothing. Other members don't see the row and the name is free again. The join functions answer a new code, `removed`, so they can't rejoin from that session and their phone says they were removed. Their answers and votes on unrevealed items, and unrevealed votes for them, are deleted in the same transaction. Revealed results stay as shown, but score and winner lists leave them out.
- New `host-actions`: `rename_guest`, `remove_guest` and `set_modules`, each behind the admin key, rate-limited per user and event, refused after the end, and written through a service-role-only RPC that checks and writes in one statement. Hosts and TVs can't be renamed or removed.
- Panel layout, party screen editing and ending the evening can be built in a cloud session now. Rename, remove and the activity switches are built on the desktop; removal waits until the quiz, awards and hot takes are merged, because it cleans up their tables.

**Why:** A host needs to fix the wifi, deal with a rude name or a stranger, and end the evening without creating a new event. Keeping the removed row, rather than deleting it, means revealed results don't change under the room and the removal is remembered when the same phone tries to rejoin. Dropping only unrevealed answers stops a removed guest from swaying what's still open without rewriting what was already shown. An undo was rejected as extra state for a rare mistake that the confirm step and rejoining under a new name already cover. Letting the host switch activities on during the evening was the owner's call, so a host can react to the room.

## 2026-10-22: What hot takes cover, and how answers work (#67)

**Decision:**
- The hot takes spec builds hot takes end to end: ready-made hot takes, picking them in the setup wizard, running them from the control panel, and hot takes on the TV and the guests' phones. AI suggestions and the summary page are left out.
- Each niche ships 20 hot takes: short statements of opinion (up to 120 characters) that guests agree or disagree with, each written in both Swedish and English. They split the room but stay light: no politics, religion, looks or anything aimed at a person in the room. They're written with Claude Code during the build and reviewed by the owner in the PR.
- The wizard picks 8 of the niche's hot takes at random. The host can untick, tick, reorder and add their own, up to 20, and edit the list from the control panel before starting and, for unplayed hot takes, during the evening. Picked hot takes are copied into the event in its language.
- Guests answer Agree or Disagree, with no neutral option. Only guests answer, late joiners included. One answer per guest per hot take, changeable until the reveal. An answer belongs to the guest, not the name.
- Answers are secret from everyone, the host included, like award votes. The database lets a guest read only their own answers; the host and the TV read no answer rows. The answer count lives on the hot take, and the splits and end highlights come from database functions, only after the reveal.
- Hot takes run like awards: one button (Show hot take, Reveal, Next hot take, Show summary), no countdown, Stop and resume at the first unrevealed hot take, unrevealed hot takes editable while none is open or revealed, and finished hot takes can't be started again. They reuse the step bounds pattern and the `module_empty` and `module_finished` codes. `create_event` takes the picked hot takes; a new `update_hottakes` action replaces the unrevealed ones.
- The TV shows the split after each reveal as Agree and Disagree bars with percentage and count, "The room is split evenly" for an exact 50/50, and at the end the most divisive and the most agreed hot take (ties to the earlier one, hot takes without answers left out). The phone shows a guest whether they were with the majority, to them only, and at the end how many times they sided with the majority.
- The ready-made hot takes can be built in a cloud session. The database and `host-actions` tickets are built on the desktop after the awards tickets are merged.

**Why:** Running hot takes the same way as the quiz and awards means the host learns one control and the build reuses what's there. Without a neutral button everyone has to pick a side, which is the point of a hot take. Keeping answers secret even from the host lets guests answer honestly, which a show of hands doesn't. Showing highlights instead of a full list at the end gives the room something to talk about without a wall of numbers. Letting the host edit the list from the control panel was the owner's call, so a host can react to the room during the evening.

## 2026-10-22: What awards cover, and how votes work (#59)

**Decision:**
- The awards spec builds awards end to end: ready-made categories, picking them in the setup wizard, running them from the control panel, and awards on the TV and the guests' phones. Hot takes get their own spec next. AI suggestions and the summary page are left out.
- Each niche ships 20 award categories in the "Most likely to…" style, each written in both Swedish and English. They are always kind: nothing about looks, weight, drinking, money or love life. They're written with Claude Code during the build and reviewed by the owner in the PR.
- The wizard picks 8 of the niche's categories at random. The host can untick, tick, reorder and add their own, up to 20. Picked categories are copied into the event in its language.
- Only guests vote. Every guest with a display name is a candidate, late joiners included; the host (who has no display name) and the TV aren't. A guest can't vote for themselves. One vote per guest per category, changeable until the reveal. A vote belongs to the guest, not the name.
- Votes are secret from everyone, the host included. The database lets a guest read only their own votes; the host and the TV read no vote rows. Counts, who has voted (host only, without picks) and results come from database functions, and results only after the reveal.
- Awards run like the quiz: one button (Show category, Reveal, Next category, Show all winners), no countdown, Stop and resume at the first unrevealed category, unrevealed categories editable while voting isn't open, and finished awards can't be started again. They reuse the quiz's step bounds and the `module_empty` and `module_finished` codes. `create_event` takes the picked categories; a new `update_awards` action replaces the unrevealed ones.
- The TV shows the winner and their vote count after each reveal, ties shared, with no runners-up and no list of guests with few votes, and every winner at the end. The phone shows a guest how many votes they got, to them only. The control panel shows the full count per guest after a reveal.
- The ready-made categories can be built in a cloud session. The database and `host-actions` tickets are built on the desktop after the quiz tickets are merged.

**Why:** Running awards the same way as the quiz means the host learns one control. Banning self-votes stops a single vote from winning a category. Hiding who voted for whom even from the host lets guests vote honestly, so the rule lives in RLS rather than the UI. Showing only winners on the TV keeps guests with no votes off the big screen at a work party, while the host still has the full count if they want to read out runners-up. Planning hot takes separately keeps the spec and the review small.

## 2026-10-22: What the quiz covers, and the module interface (#49)

**Decision:**
- The quiz spec builds the quiz end to end: ready-made questions, picking them in the setup wizard, running the quiz from the control panel, and the quiz on the TV and the guests' phones. It also defines the shared module interface that awards and hot takes will follow. AI suggestions, the summary page, and editing the party screen, removing guests or ending the event from the control panel are left out.
- Each niche ships 30 quiz questions, each written in both Swedish and English (the same question translated), with four options and one right answer. They are timeless and light, suit the niche, and nothing in them dates or could embarrass anyone. They're written with Claude Code during the build and reviewed by the owner in the PR.
- The wizard picks 10 of the niche's questions at random. The host can untick, tick, reorder and add their own, up to 30 in a quiz. Picked questions are copied into the event in its language.
- One point per right answer, no speed bonus. Only guests play; the host sees the right answer and has no score. Late guests join at the current question, and missed questions count as 0. A score belongs to the guest, not the name, so renaming keeps it.
- No countdown. The host reveals when ready; guests can change their answer until then. One button in the control panel does the next thing: Show question, Reveal, Next question, and Show results after the last.
- Stop takes the TV back to the party screen. Starting the quiz again continues at the first unplayed question with the scores kept. A question counts as played once it's revealed. The host can edit unplayed questions while no question is open or revealed; played questions are locked. A finished quiz can't be started again in that event.
- While the quiz runs, it takes the left side of the TV and the join panel stays on the right. The TV shows "Question 3 of 10, get ready", then the question with options A to D and "7 of 12 answered", then the right answer with a bar per option, and at the end the top 3 (ties share a place). The phone shows the question with four big buttons, then right or wrong and the score so far, and at the end the guest's own score and place. The control panel shows the full list. There are no standings between questions.
- The right answers live in their own table that guests and the TV can read only after the reveal, and a question can be read only once it's shown. The TV shows how many have answered through a count the database keeps on the question, without seeing any answers.
- Module interface: the registry lists each activity's id, name, TV view, guest view, control panel section and optional wizard step. The TV and guest page show the running activity's view, or the party screen when the activity has no definition yet. On the server the flow state machine stays generic and takes per-activity step bounds (first unplayed step, number of steps, finished).
- New `host-actions` error codes: `module_empty` (starting a quiz with no questions) and `module_finished` (starting a finished quiz). `create_event` takes the picked questions; a new `update_quiz` action replaces the unplayed ones.
- The spec changes `host-actions`, so it's built on the desktop.

**Why:** A quiz can't be tried without a way to run it, so the spec covers every screen it needs instead of waiting for the control panel spec. Speed bonuses reward fast thumbs over knowing the answer and would need the server to time every answer. A countdown would need the database to close answers at an exact time, while a party quiz is paced by the room. Resuming lets a host split the quiz around dinner, where starting over would throw away answers by mistake. Showing only the top 3 keeps the bottom of the list off the TV at a work party. Keeping the right answers in a separate table makes "no peeking from devtools" a plain RLS rule instead of column tricks. Defining the module interface with a real module avoids guessing at it (decision 2026-10-21).

## 2026-10-22: Details settled while building the party screen and guest join (#40)

**Decision:**
- QR codes are always drawn black on white, the one place a component sets its own colors. Phone cameras read dark-on-light codes most reliably, whatever the niche theme.
- Before joining, the guest page can't read the event, because RLS only shows an event to its members. So the name form, and the notes for an unknown code or an ended event, use the device's language and the default look. A wrong or expired code is shown after the guest taps Join. The event's language and theme apply from "You're in" on.
- The TV's guest count, guest list and welcome pop-up all count only guests who have a display name.
- Database tests can run in a cloud session: start Docker with `sudo dockerd &`, then `npm run db:start`. The Edge Function tests still fail there, because the local function runtime can't fetch npm packages through the cloud proxy, so `host-actions` changes still need the desktop.

**Why:** A themed QR code that a phone can't scan defeats the join panel. Telling a non-member whether a code exists before they join would let anyone probe codes, which the join RPCs already avoid. Counting the same guests everywhere keeps the TV consistent.

## 2026-10-21: What the party screen and guest join cover (#40)

**Decision:**
- The spec builds three things: the TV party screen (`/tv/:code`), guests joining and their "You're in" page (`/p/:code`), and a "Join with code" box on the start page. Activities, the summary page, and the host editing the party screen or removing guests during the evening are left out. Removing a guest needs a database change and comes with the control panel spec.
- The TV joins as the TV by itself. A panel on the right always shows the join QR code, the code, the join address and the number of guests. The left side rotates every 12 seconds between welcome, menu, schedule, wifi (QR code plus network name and password in text), music (QR code) and the guests who have joined, skipping parts the host left out. A single part just stays. Many guest names shrink to fit instead of scrolling.
- When a guest joins, the TV shows "Welcome, <name>!" for a few seconds. The guests already there when the TV loads are not greeted.
- The TV asks the browser to keep the screen awake. Until an activity exists, a running activity also shows the party screen; each activity's spec hands the left side to its own TV view.
- A guest types only a display name; the code comes from the QR link. After joining they see "You're in" with a way to rename, and the welcome, menu, schedule, wifi with a Copy button for the password, and an "Open music" button. A returning guest on the same phone skips the name step. A phone that is already the host or TV sees a short note instead of the name form. An ended event shows a thank-you on both TV and phone.
- The guest page finds out whether the phone is already a member by reading the event with that code. RLS only returns an event to its members, so this needs no database change.
- `qrcode.react` is added as a dependency to draw the QR codes in the browser.
- The look isn't final. The spec uses shadcn/ui defaults with the niche's theme tokens so a design can be applied later.

**Why:** The TV and guest pages were placeholders, and every activity needs both. Keeping the join panel fixed means a guest can join at any moment, while the rotation keeps the screen alive. Wifi details in text help phones that can't scan wifi codes. Leaving guest removal out keeps the spec free of database changes, so it can be built in a cloud session. `qrcode.react` is small, has no dependencies and draws everything locally; writing a QR encoder ourselves would be a lot of code for no gain.

## 2026-10-21: Loose docs live in docs/, tool config stays at the root

**Decision:**
- `GLOSSARY.md`, `IDEAS.md` and `implementation.md` moved from the repo root into `docs/`. The copied skills in `.claude/skills/` point at `docs/GLOSSARY.md`.
- The empty Prettier config moved from `.prettierrc.json` into a `"prettier": {}` key in `package.json`.
- Everything else at the root stays, because the tools look for it there: `package.json` and the lockfile, the `tsconfig` files, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `vercel.json`, `components.json` (shadcn), the dotfiles, `README.md` and `CLAUDE.md`.
- New docs go in `docs/`, not the root.

**Why:** The root was hard to scan on GitHub. Moving tool config into a subfolder would need custom paths in several tools and break their defaults, so only docs and the empty config were moved. The Prettier key is kept, rather than deleted, so an editor's own Prettier settings can't override the project's defaults.

## 2026-10-21: The party screen and guest join come next, before the activities

**Decision:** The next spec builds the TV party screen and guests joining from their phones. The activities (quiz first), cleanup and AI follow after it.

**Why:** The architecture check after the wizard (#37) found the TV and guest pages still empty, while `CLAUDE.md` calls the party screen the layer that must work even if no activity ever runs. The backend it needs (join RPCs, live updates) is built and tested. Every activity needs guests who have joined and a TV that shows something, so building them first keeps the quiz spec smaller. Starting with the quiz was rejected because it would have had to build basic TV and join screens anyway.

## 2026-10-21: Details settled while building the setup wizard (#29)

**Decision:**
- Skip on the welcome step puts back the niche's ready welcome text. Skip on the other steps clears what was typed there, so that part is left out of the event.
- The control panel shows the code and TV address, and keeps the host link hidden until the host taps "Show host link". Copy and Share work without showing it. The done screen still shows it in full.
- The wizard's inputs and Add buttons use the party schema's limits, so anything the wizard accepts also survives a reload and passes the server.
- The shadcn components added here (card, input, switch, textarea) were written by hand in the existing style, because the shadcn CLI couldn't reach its registry from the cloud session.

**Why:** A host in a hurry who skips everything should still get a good TV. A host who mirrors their phone or shares the screen shouldn't show the key to the room, since anyone with it can run the evening.

## 2026-10-21: What the setup wizard covers (#29)

**Decision:**
- The setup wizard comes next, after the backend core. The order of the later steps (activities, cleanup, AI) is still open.
- The wizard offers all three niches. Team event and Bachelor/bachelorette get their configs now (name, description, placeholder theme, default activities); their activity content comes with each activity.
- The wizard asks for niche, language, activities, welcome text, menu, schedule, wifi and music link, in short phone steps with Back and Next, then a summary and Create. Every step after language can be skipped. It doesn't ask for guest names, a vibe or themes: guests type their own name when they join, and vibe and themes would only steer AI or content picking, so they come back with those plans if needed. Picking quiz questions, award categories and hot takes is added to the wizard by each activity's spec.
- Each niche ships a ready welcome text in Swedish and English, filled in and editable. Menu, schedule, wifi and music start empty.
- The language step starts on the host's current UI language. A host may switch every activity off; the TV then shows only the party screen.
- Unfinished wizard input is kept in this browser and cleared after Create. Nothing reaches the server before Create. A failed create shows a plain message and keeps the input.
- The last screen shows the code, the host link with Copy and Share (the phone's share menu), a warning that the link can't be shown again, the TV address, and a button into the control panel. It shows no QR code; the TV shows the join QR code.
- The browser that created an event remembers its host link. The start page lists these under "Your events", each with a way back into the control panel and a Forget button, and drops them after the event's 30-day expiry. Anyone holding the unlocked device can open the control panel, which was accepted.
- The wizard spec builds only the door into the control panel: opening the host link claims the host role and shows the code, TV address and host link; a wrong or expired link shows an error. Running activities and editing the party screen come with the control panel spec.
- `@playwright/test` is added as a dev dependency. One test clicks through the wizard at phone size with the `host-actions` answer faked, so it runs in cloud sessions without Docker.

**Why:** Every later step needs a way to create an event, and the backend for it already exists, so the wizard is small and safe. Steps keep each screen short on a phone. Asking for things nothing uses yet would only slow the host down. The host link is the only way back into an event, so the wizard makes it hard to lose: a clear warning, Share, and a copy on the device. Faking the server in the browser test keeps it fast and runnable anywhere; `host-actions` itself is already tested over HTTP.

## 2026-10-21: How a live event view handles a failed refetch and a non-member (#23)

**Decision:**
- `subscribeToEvent` in `src/api/realtime.ts` treats every change as a signal to refetch the snapshot. When a refetch fails, the view keeps the last snapshot on screen and sets the error code (`useEventState` goes to `error` with the old `event` and `members`); the next successful refetch makes it `ready` again.
- A subscription by someone who isn't a member of the event only ever gets `not_found`, never event or member data. RLS decides every read, so the realtime channel itself carries nothing the caller couldn't read directly.

**Why:** A TV losing the network for a moment should keep showing the party screen instead of going blank. Answering a non-member with `not_found` matches the join RPCs, so nobody learns more about an event from realtime than from joining it.

## 2026-10-21: How `update_party_content` replaces the party screen (#19)

**Decision:**
- The body is `{ action: "update_party_content", code, key, party }`, where `party` is validated by the same `PartySchema` that `create_event` uses. It replaces `events.party` as a whole: parts the host leaves out are removed. It answers `{}`; members see the new content on their next read.
- An ended event's content can't be changed: it answers `409 invalid_transition`, the same code as any flow move after the end, so "the event is over" has one code for the host. An expired event answers `403 not_authorized` like every other host action, because the admin key check already treats it as unknown.
- The write goes through the service-role-only RPC `update_event_party`, which checks expiry and status in the same statement as the update and answers `updated`, `ended` or `not_found`, so an event that ends or expires between the key check and the write is never changed.
- After the key check, updates are rate-limited per user and event: 10 per minute, counted under `update_party_content:<event id>`.

**Why:** Replacing the whole object keeps the action simple and matches the wizard, which edits all of it at once. Reusing `invalid_transition` avoids a new error code and i18n key for a case the host only reaches after ending the event. Ten saves a minute is plenty for fixing a typo or the wifi password during the evening.

## 2026-10-21: How `set_flow` moves the event's flow (#20)

**Decision:**
- The body is `{ action: "set_flow", code, key, move }`, where `move` is one of `start_module` (with `module`), `stop_module`, `next_step`, `open`, `reveal` and `end_event`. It answers the flow after the move: `{ status, currentModule, currentStep, phase }`.
- Which move is allowed in which state lives in one place, the state machine in `supabase/functions/host-actions/flow.ts`, with the table in its header. An activity can only start when none is running (stop it first). `next_step` is allowed from `idle` (skipping a step) and `revealed`, but not while a step is `open`, so guests' answers are never dropped unseen. `stop_module` leaves the event `live` with no activity: the party screen. `end_event` clears the activity, and after it every move, `end_event` included, answers `invalid_transition`.
- Disallowed moves answer `409 invalid_transition`; starting an activity that isn't in `enabled_modules` answers `409 module_disabled`.
- The write is a compare-and-set: the service-role-only RPC `set_event_flow` changes the event only if it still has the flow the move was checked against, so two simultaneous moves can't both apply. A new constraint, `events_flow_check`, holds the same shape in the database: no activity means step 0 and `idle`, and an activity means `live` with an enabled activity.
- After the key check, moves are rate-limited per user and event: 30 per minute, counted in `private.rate_limits` under `set_flow:<event id>`. `consumeEventRateLimit` in `rate-limit.ts` builds that key and is meant for the other actions that run after the key check, such as `update_party_content`.

**Why:** Keeping the rules in a plain TypeScript function makes them readable in one table. The compare-and-set and the constraint make sure the database never holds a broken flow, whatever the function does. Counting per event lets a host who runs two events keep their limit on each.

## 2026-10-21: How the admin key check and `claim_host` work (#18)

**Decision:**
- Every host action except `create_event` starts with `authorizeHost(db, caller, code, key)` in `supabase/functions/host-actions/admin-key.ts`, which answers the event id or `not_authorized`/`rate_limited`. Request schemas spread `hostLinkFields` (`code`, `key`) from `src/lib/schemas/host-actions.ts`.
- The stored hash comes from a service-role-only RPC, `event_admin_key_hash(code)`, which finds no row for an unknown or expired code. The function hashes the received key and compares the two hex hashes in constant time in TypeScript. An unknown code is compared against a dummy hash, so both paths do the same work.
- A wrong key, a key for another event, an unknown code and an expired event all answer `403 {"error":"not_authorized"}`.
- Only failed key checks are counted, as `admin_key_failure` in `private.rate_limits`: 10 per user per 10 minutes. Before checking a key, the read-only RPC `rate_limit_reached` asks whether the caller is over the limit; if so, even the right key answers `rate_limited` until the window has passed. Parallel requests can each pass that check before a failure is counted, which gives a burst a few extra guesses at a 256-bit key and was accepted.
- `claim_host(caller, target_event_id)` upserts the member row as `host`. A guest or TV of the event becomes host in their existing row, and a guest's display name is cleared (hosts have none), which frees the name for other guests. It answers `{}`.

**Why:** Postgres has no constant-time text comparison, and the key never reaches SQL, so the comparison happens in the function. Counting only failures means a host who reopens the link many times is never locked out. Refusing the right key while over the limit means a guesser learns nothing from an attempt made over the limit.

## 2026-10-21: How `host-actions` and `create_event` work (#17)

**Decision:**
- The function reaches `private` through two `public` RPCs that only `service_role` may execute: `create_event` (inserts the event, its admin key hash and the host member in one transaction, and answers null on a code clash so the function retries with a new code) and `consume_rate_limit` (a fixed window per user and counter name, counting every attempt). The Data API exposes only `public`, so this avoids a direct Postgres connection and a new driver dependency.
- The admin key is generated, hashed and returned in the function; the database only ever sees the hash. The hash is SHA-256 of the key's text as it appears in the host link, stored as lowercase hex in `private.event_secrets`. The event code is generated in the function with rejection sampling, so every character is equally likely.
- The gateway's JWT check is off for `host-actions` (`verify_jwt = false` in `supabase/config.toml`), because it would refuse CORS preflights. The function checks the caller's session itself with `auth.getUser`; the publishable or anon key alone is refused as `not_authenticated`.
- Checks run in this order: CORS, method, body size (32 KiB, read as a capped stream, so an oversized body is never parsed), JWT, the Zod request union, the action's rate limit. `create_event` allows 5 per user per hour.
- A request with an `Origin` that isn't in `ALLOWED_ORIGINS` is refused with `origin_not_allowed`, preflight or not. A request without `Origin` doesn't come from a browser page, so CORS doesn't apply; it still needs a valid session.
- Error codes so far: `invalid_request`, `not_authenticated`, `origin_not_allowed`, `method_not_allowed`, `payload_too_large`, `rate_limited`, `internal_error`, listed once in `src/lib/schemas/host-actions.ts`. The app's wrapper adds `network_error` for a call that got no answer, and maps any answer it doesn't recognise to `internal_error`.
- `events.party` is `{ welcome?, menu?, schedule?, wifi?, musicUrl? }` (`src/lib/schemas/party.ts`): every part optional, unknown fields refused, the music link https only.
- Shared schemas import only `zod` and relative paths with a `.ts` extension, because the function imports them under Deno. Niche ids therefore live in `src/niches/ids.ts`, and the typecheck makes `niches` list exactly those ids.
- `npm run test:db` serves this checkout's functions itself (`supabase/tests/functions-setup.ts`), with `ALLOWED_ORIGINS` from a test env file in `supabase/.temp/`. The local gateway answers every preflight itself with `*`, unlike the hosted one, so the preflight tests call the edge runtime directly from inside the Docker network.

**Why:** The ticket left these details open. Generating the key in the function keeps it out of SQL statements and database logs. Counting every `create_event` attempt, not only failures, is what limits flooding.

## 2026-10-21: How the join RPCs and db tests work (spec 1 build)

**Decision:**
- `join_event` and `join_tv` return a `join_result` (`event_id`, `error`) instead of raising. On success `error` is null; otherwise it holds the code (`not_found`, `ended`, `name_taken`, `invalid_name`, `rate_limited`) and `event_id` is null. Calling without a session is refused by Postgres before the function runs.
- Codes are matched in upper case with surrounding whitespace removed, so a guest can type `ab3xyz `.
- An existing member who calls a join RPC again gets the event id back with nothing changed, whatever their role, also after the event has ended. Only a new join to an `ended` event answers `ended`.
- Display names are trimmed of whitespace including no-break and zero-width spaces, by one function (`private.clean_display_name`) that both the members trigger and `join_event` use.
- Throttling is a fixed window per user: the first failure starts a one-minute window, and the tenth failure in it blocks both RPCs until the window ends. Each join locks the caller's counter row, so parallel requests are counted one at a time. Limit and window are `private.join_failure_limit()` and `private.join_failure_window()`; the retention is `private.event_retention()`.
- A guest renames themselves with a normal `update` on `display_name`. A name clash is a unique violation on `members_guest_name_key`, which the data layer maps to `name_taken`; a bad length is a check violation it maps to `invalid_name`.
- `role`, `status` and `phase` are `text` with `check` constraints, not Postgres enums, so values can be added and removed with a plain migration. The data layer narrows them with Zod.
- The db tests live in `supabase/tests/` with their own `tsconfig.db.json`, and are exempt from the ESLint rule that keeps Supabase inside `src/api/` (CLAUDE.md principle 3), because they test the database through the client directly. They read the URL and keys from `supabase status`, and use `psql` inside the database container only for the catalog guardrails and to move the server-only throttle window.
- The local stack allows 10,000 anonymous sign-ins an hour (`supabase/config.toml`), because every `npm run test:db` signs in about 150 fresh users. The hosted project keeps the limit set in its dashboard.

**Why:** A raised error rolls back the whole call, which would also roll back the failure counter, so errors have to be returned for throttling to work. Returning every code the same way keeps the data layer simple. The rest follows the spec; these are the details it left open.

## 2026-10-21: The backend core is built as two specs

**Decision:**
- The rest of the backend core plan is split into two specs, each built as one PR. Spec 1 is the database, its RLS and the join RPCs. Spec 2 is `host-actions`, the function typecheck, `src/api/` with realtime, and admin key parsing.
- Spec 1 creates no `private.event_secrets`. That table arrives with `create_event` in spec 2. Spec 1's tests seed events and host members with the service role.
- The shared module interface (Step 7) moves to the first module's spec.
- Tests use only three seams: the Supabase client signed in as each role (RLS and RPCs), `host-actions` over HTTP, and `src/api/` (realtime and the wrappers). One test reads the database catalog directly to check that every table in `public` has RLS on; it's an intended guardrail, not a fourth seam.

**Why:** The owner reviews the migration and RLS, the most security-sensitive code, in a small PR before anything is built on it. One spec was rejected as one large review. An interface written before any module exists is a guess; the quiz will give it a real shape. Testing only through the doors the app and an attacker use keeps the tests valid when the inside changes.

## 2026-10-21: CAPTCHA is added before the public launch, not in the backend core

**Decision:** The backend core has no CAPTCHA. Before Mingle is shared publicly, anonymous sign-in gets a CAPTCHA, using Cloudflare Turnstile (free) through Supabase's built-in support, with the widget on the join and create pages.

**Why:** There are no pages to put it on yet. Until launch, the join RPCs and `host-actions` are rate-limited per user and Supabase limits anonymous sign-ins per IP. Never adding it was rejected, because bots could create many sessions once Mingle is public. Building it now was rejected as setup with nothing to attach it to.

## 2026-10-21: Event data is kept for 30 days after creation (open question E)

**Decision:** `events.expires_at` is set to 30 days after `created_at`, from one constant in the migration. An expired event counts as no membership at once, and the later `cleanup` function deletes it and everything that belongs to it.

**Why:** 30 days covers a few weeks of preparation plus the summary page afterwards, without keeping guest names and answers longer than needed. 14 days was rejected because a host who prepares two weeks ahead would lose the event before the party. 90 days was rejected as keeping personal data longer than the evening needs. It's one constant, so it's easy to change.

## 2026-10-21: The TV joins with the event code (TV as a member)

**Decision:** The TV opens `/tv/:code` and joins with the event code through `join_tv`, which makes it a `tv` member. There is no separate TV token.

**Why:** A TV member can read nothing a guest can't (the event, its members, approved content and revealed results), and the code is shown on the TV anyway. Anyone with the code can register as a TV, which is no more exposure than joining as a guest. The stricter option, a secret TV link from the host panel, was rejected as one more link for the host to manage and more to build and test, without protecting anything.

## 2026-10-21: Edge Function code is typechecked with `deno check`

**Decision:** Add the `deno` npm package as a dev dependency and a `typecheck:functions` script that runs `deno check` on `supabase/functions/`. It is added before `host-actions` is built (in the backend core spec, ahead of the `host-actions` tickets), not in the Step 1 tooling PR.

**Why:** The Step 1 spike showed that `supabase functions serve` only strips types, and the app's `tsc -b` doesn't cover `supabase/functions/`, so function code was only linted. The rejected alternatives were relying on lint plus integration tests, and running `tsc` on the functions, which doesn't understand `npm:` specifiers or Deno types without extra setup.

## 2026-10-21: AI suggestions are an optional bonus; niches ship built-in content

**Decision:**
- Mingle works fully without AI. Each niche ships built-in content in Swedish and English: quiz questions, award categories and hot takes. The host picks from it and adds their own.
- The built-in content is written with Claude Code and reviewed by the owner before it's merged, so it is approved content under principle 6.
- AI suggestions are a bonus on top. When no AI key is configured, the app hides them.
- The AI provider is chosen when AI gets its own plan: the Claude API, or a free tier such as Gemini's (check its data terms first). Whichever it is, it's called only from the `ai-suggest` Edge Function, its output is validated and stored as drafts until the host approves, and prompts never include guest names or other personal data.

**Why:** Running Mingle should cost nothing at small scale. The free plans of Supabase and Vercel cover hosting, and AI is the only part that always costs money (estimated on this date at about 2 cents per party on Claude Haiku 5.5 and about 70 cents on Claude Opus 5.5). Built-in content is free, instant and has no rate limits, and it's reviewed once instead of at every party, which matters because AI-written trivia can get facts wrong. Free AI tiers can change their quotas without notice and may use prompts to train models, so the app mustn't depend on them. Keeping personal data out of prompts makes the provider choice a question of quality and cost only. Keeping AI as the main source of content was rejected because of the running cost and the hard dependency on one paid API.

## 2026-10-21: Database specs are built on the desktop, one database ticket at a time

**Decision:** Specs that touch `supabase/` can be planned in any session, but `/implement-spec` for them runs on the desktop, where Docker runs the local Supabase stack. Tickets that touch `supabase/` are built one at a time; other tickets still run in parallel. The `implementer` and `merger` also run `format:check`, and `test:db` when the change touches `supabase/`. These specs get `/security-review` after `/diff-review`, their security-critical tickets run the `implementer` on Opus, and the security rules from the design go into ticket acceptance criteria. "Database rules" in `CLAUDE.md` is written now, before the backend core is built, so implementers and `/diff-review` check against it from the first ticket.

**Why:** `test:db` needs Docker. Cloud sessions can start Docker, but their network policy blocks the Supabase images (tested 2026-10-21), so cloud implementers couldn't test database code and test-first work would be guesswork. All worktrees share one local stack, and `db:reset` from one worktree replaces the schema under another. Separate stacks per worktree with their own ports were rejected as too much setup for a few tickets. `/diff-review` checks standards and the spec but not security, and this is the most security-sensitive code in the project.

## 2026-10-21: Agent workflow built on Matt Pocock's skills

**Decision:** Larger changes go grill, spec, tickets, implement, using skills copied from [mattpocock/skills](https://github.com/mattpocock/skills) (commit `5beb35b`) into `.claude/skills/`. Specs and tickets are GitHub issues and replace plans in `docs/plans/`. The main session orchestrates (Opus recommended); the `implementer` and `merger` subagents run on Sonnet and `Explore` on Haiku. Mingle's edits to the copies: `code-review` is renamed `diff-review`, decisions go to this file instead of `docs/adr/`, `to-spec` applies no triage label, and the setup is written by hand in `docs/agents/`, so `setup-matt-pocock-skills` isn't included.

**Why:** The skills already cover planning with the owner, ticket breakdown and per-ticket subagents, so only the model choice is ours. They're copied instead of installed as a plugin because cloud sessions don't load plugins. `code-review` clashes with Claude Code's built-in skill of the same name. GitHub Issues fits that GitHub is the only thing every device shares. A custom planner subagent was rejected because subagents can't ask the owner questions.

## 2026-10-20: The host's session is bound to the event (open question C)

**Decision:** The host signs in anonymously like guests and the TV. When `host-actions` verifies the admin key (`create_event` or `claim_host`), it records that session as `host` in `members`. RLS then lets the host read everything in their event, including drafts and individual answers, directly and through realtime. Every host write still goes through `host-actions` with the admin key, as `CLAUDE.md` principle 2 requires.

**Why:** The host panel needs live data that guests must not see. Binding the session lets RLS and realtime serve it. The rejected alternative was routing every host read through the Edge Function, which keeps RLS simpler but gives the host panel no realtime, so it would have to refetch or poll. A side effect is that anyone who opens the host link on another device becomes a co-host, which matches what a shared admin link means.

## 2026-10-20: Server-only tables live in a `private` schema

**Decision:** Secrets and internal counters (the admin key hash and rate limits) go in a `private` schema that the Data API doesn't expose. RLS stays enabled on them with no client policies, on purpose.

**Why:** Keeping the admin key hash out of `public` means no policy mistake can leak it. The "a table without policies is a bug" rule in `CLAUDE.md` applies to tables clients can reach; `private` tables are server-only by design.

## 2026-10-20: Database and RLS tests run against a local Supabase stack

**Decision:** Add the Supabase CLI as a dev dependency once the backend core plan is approved. Schema, RLS, RPCs and Edge Functions are tested by Vitest integration tests (`*.db.test.ts`) that sign in as each role against a local stack in Docker, run with `npm run test:db`. `npm run test` stays fast and needs no Docker.

**Why:** RLS is where a bug would hurt most, so it's tested through the real client the app uses, in the same language and runner as the rest of the tests. pgTAP (tests in SQL) was rejected as a second test language. A hosted test project was rejected because it needs extra secrets and a project to maintain. The cost is that cloud sessions without Docker can't run `test:db`, so it's run on the desktop before merging.

## 2026-10-20: The backend core creates only the shared tables

**Decision:** The backend core migration creates `events` and `members` (plus the `private` tables). Each module plan adds its own typed tables, following the draft/approved and answer-visibility pattern in [`docs/plans/backend-core.md`](plans/backend-core.md).

**Why:** Typed tables per module keep database constraints meaningful. Generic `module_items`/`responses` tables with JSON payloads would save a few migrations but move all checks into application code.

## 2026-10-15: shadcn/ui 4 setup with Radix, the cn package and the Geist font

**Decision:**
- Initialize shadcn/ui 4 with Radix primitives and the "nova" preset (style `radix-nova`, neutral colors, Lucide icons).
- Accept the dependencies that setup brings, all three beyond the original foundation plan:
  - `cn`, shadcn's own class-merging package. It replaces `clsx` + `tailwind-merge`.
  - `shadcn` as a **dev** dependency, because `src/index.css` imports `shadcn/tailwind.css`.
  - `@fontsource-variable/geist`, the preset's self-hosted font, until the visual design picks one.

**Why:** shadcn 4 changed its setup after the plan was written. A trial run in a scratch copy showed exactly what `init` adds.
- Keeping the generated setup means future `shadcn add` components work without edits. Copying the CSS file into the repo, or hand-writing the older `clsx` setup, was rejected for that reason.
- The `shadcn` package pulls in about 270 install-time packages. It's listed as a dev dependency, because only its CSS reaches the browser.
- The font is self-hosted, so pages make no requests to third-party font servers.

**Known issue:** `npm audit` reports 7 high-severity findings, all from a single advisory (GHSA-vfj7-8cjw-p6xm: `braces` ≤3.0.3, a denial of service through deeply nested glob patterns). It reaches us only through the shadcn CLI's `fast-glob`. There is no patched `braces` release yet. The CLI only runs locally on our own files, so this is accepted for now. Revisit when a fix is published.

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
