# Mingle

Set up an interactive party evening in a few minutes. A host creates an event, picks a niche (afterwork, team event, bachelor/bachelorette party) and gets ready-made activities. Guests join from their phones by scanning a QR code on the TV, and results show up live on the big screen.

> **Status:** early development. The project is being scaffolded; there is no runnable app yet.

## Why

Every afterwork, team event or bachelor party ends up with entertainment built from scratch: quiz questions in a doc, votes by show of hands, nothing on the TV. Generic quiz tools need content written up front. Mingle gives the host niche-specific, AI-assisted (always host-approved) content suggestions and one place to run the whole evening.

## How it works

There are three views, all served by one app:

| View | Who | What it does |
|---|---|---|
| Host | The person running the evening | Creates the event and controls it from their phone |
| TV | A browser on a TV or laptop | Shows the shared screen: lobby, activities, results |
| Guest | Everyone else, no account needed | Joins with a code or QR, picks a display name, answers and votes |

### Two layers

1. **Party screen (always on).** With no activity running, the TV rotates between a welcome message, join QR code, music and wifi QR codes, menu, schedule and the guests who have joined.
2. **Activities (optional).** The host can start any of these, and can switch any of them off when creating the event:
   - **Quiz**
   - **Awards**: "most likely to…" voting on guest names
   - **Hot takes**: agree/disagree polls

AI suggestions for activity content are generated on request. Nothing is shown to guests or on the TV until the host has reviewed and approved it.

## Tech stack

- Vite, React, TypeScript (strict)
- Tailwind CSS v4 and shadcn/ui
- React Router
- Supabase: Postgres, Realtime, Storage, Edge Functions, anonymous sign-in
- Claude API, called only from a Supabase Edge Function
- Zod for validation, react-i18next for Swedish and English
- Vitest and Playwright for testing
- Hosted on Vercel (frontend) and Supabase (backend)

## Project documents

- [CLAUDE.md](CLAUDE.md): scope for v1, architecture principles, folder structure and working rules
- [IDEAS.md](IDEAS.md): parking lot for ideas that are not part of v1

## Privacy

Guests are identified by a display name only. No emails, phone numbers or other personal data are stored, and event data is deleted automatically after a fixed retention period.
