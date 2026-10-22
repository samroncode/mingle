# Hosting

How Mingle runs online, and the one-time checklist to put it there. Everything is on free plans: Vercel Hobby (non-commercial use), two free Supabase projects and a free Cloudflare account.

## Environments

| | Live | Staging | Preview |
|---|---|---|---|
| What it is | The real app at `https://mingle.vercel.app` (or the closest free name) | A second Supabase project used for testing | A Vercel deployment of one PR branch, at its own address |
| Backend | Supabase project ref `gbqquufjzugqgyqaqdcu` | The staging Supabase project | Staging |
| CAPTCHA (Turnstile) | On | Off | Off |
| Used for | Real parties only | Trying PRs, test events | Trying a PR on the phone before merging |

## What deploys what

- **Merge to `main`** runs the **Deploy** workflow (`.github/workflows/deploy.yml`): migrations and Edge Functions to live, then to staging, then the Vercel deploy hook publishes the app. A failure at any step stops the run before the Vercel step, so live keeps the old app and the run shows red on GitHub.
- **Staging** (`.github/workflows/staging.yml`, manual): run it with a branch name to put that branch's migrations and functions on staging, so its preview link works. Tick **reset** to wipe staging and put it back to `main` (the branch is ignored).
- **Keep awake** (`.github/workflows/keep-awake.yml`): once a day it reads one row from both projects so neither goes to sleep.
- **Preview deploys** of PR branches are made by Vercel itself.

Live only changes through the Deploy workflow, after the owner's merge. Agents never deploy by hand.

The Edge Function secret `ALLOWED_ORIGINS` and the Supabase Auth settings are set by hand once (checklist below), not by the workflows.

## Launch checklist

Do these in order, at the desk, with your own logins.

### 1. Supabase

Staging project:

1. supabase.com → New project. Name it `mingle-staging`. Save the database password.
2. Authentication → Sign In / Providers: turn **Allow anonymous sign-ins** on.
3. Authentication → URL Configuration: set **Site URL** to your preview address pattern's base, for example `https://mingle-git-main-<team-slug>.vercel.app`.
4. Set the Edge Function secret (use the preview pattern with the `*` in the first host label, plus localhost):

   ```
   npx supabase link --project-ref <staging ref>
   npx supabase secrets set ALLOWED_ORIGINS="https://mingle-*-<team-slug>.vercel.app,http://localhost:5173"
   ```

Live project (`gbqquufjzugqgyqaqdcu`):

1. Authentication → URL Configuration: set **Site URL** to the live address.
2. Authentication → Rate Limits: set **Anonymous sign-ins** per IP address to **300** per hour (a whole party on one wifi shares one address).
3. Authentication → Attack Protection: turn **CAPTCHA protection** on, choose Turnstile and paste the Turnstile **secret key** from step 2 below.
4. Set the Edge Function secret with exact addresses only (no wildcard on live). Keep localhost only while you want to develop against live:

   ```
   npx supabase link --project-ref gbqquufjzugqgyqaqdcu
   npx supabase secrets set ALLOWED_ORIGINS="https://mingle.vercel.app,http://localhost:5173"
   ```

### 2. Cloudflare Turnstile

1. dash.cloudflare.com → Turnstile → Add widget.
2. Hostname: the live hostname, for example `mingle.vercel.app`. Widget mode: **Managed**.
3. Copy the **site key** (goes in Vercel, step 3) and the **secret key** (goes in Supabase, step 1).

### 3. Vercel

1. vercel.com → Add New → Project → import `samroncode/mingle`.
2. Framework preset **Vite**, build command `npm run build`, output directory `dist`. Project name `mingle`, or the closest free one.
3. Settings → Environment Variables. Only browser-safe values go here.
   - **Production**: `VITE_SUPABASE_URL` (live), `VITE_SUPABASE_PUBLISHABLE_KEY` (live), `VITE_TURNSTILE_SITE_KEY`.
   - **Preview**: `VITE_SUPABASE_URL` (staging), `VITE_SUPABASE_PUBLISHABLE_KEY` (staging). No Turnstile key.
4. Settings → Git → turn off automatic production deploys of `main` (Ignored Build Step: `if [ "$VERCEL_ENV" = "production" ]; then exit 0; fi; exit 1`, or the equivalent "disable production branch deployments" setting). Preview deploys stay on.
5. Settings → Git → Deploy Hooks → create a hook named `deploy` for branch `main`. Copy its URL.
6. The team slug for the preview pattern is in your Vercel URL (`vercel.com/<team-slug>`) and in any preview address: `mingle-git-<branch>-<team-slug>.vercel.app`.

### 4. GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret. Add every one of these, by exact name:

| Secret | Value | Used by |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens | Deploy, Staging |
| `SUPABASE_LIVE_PROJECT_REF` | live project ref (`gbqquufjzugqgyqaqdcu`) | Deploy |
| `SUPABASE_LIVE_DB_PASSWORD` | live database password | Deploy |
| `SUPABASE_STAGING_PROJECT_REF` | staging project ref | Deploy, Staging |
| `SUPABASE_STAGING_DB_PASSWORD` | staging database password | Deploy, Staging |
| `VERCEL_DEPLOY_HOOK_URL` | the deploy hook URL from Vercel | Deploy |
| `LIVE_SUPABASE_URL` | live project URL | Keep awake |
| `LIVE_SUPABASE_PUBLISHABLE_KEY` | live publishable key | Keep awake |
| `STAGING_SUPABASE_URL` | staging project URL | Keep awake |
| `STAGING_SUPABASE_PUBLISHABLE_KEY` | staging publishable key | Keep awake |

The repo is public; GitHub does not give secrets to workflows from forks.

### 5. First deploy

The Deploy and Keep awake workflows are skipped until you switch them on, so they do not fail (and send you mail) before everything above exists.

0. Repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable. Name `HOSTING_ENABLED`, value `true`. This is a variable, not a secret. Turn it off again (delete it or set it to anything else) to pause both workflows.
1. GitHub → Actions → **Staging** → Run workflow with **reset** ticked. It should go green.
2. Actions → **Deploy** → Run workflow on `main`. It should go green, and Vercel should show a new Production deployment.
3. Actions → **Keep awake** → Run workflow. Both targets should go green.

### 6. Phone smoke test

1. On the phone, open the live address and create an event.
2. Open the TV link on a laptop.
3. Join as a guest on mobile data, and as another guest on the same wifi as the TV.
4. Check that the QR code on the TV opens the live address.
5. Run a host action from the control panel (for example change the party content) and check it shows on the TV.
6. Open devtools on the laptop and check the console has no CSP or CORS errors.

## Looking after it

- **Keep-awake paused.** GitHub switches scheduled workflows off after 60 days without repo activity. If both projects are still wanted, open Actions → **Keep awake** → Enable workflow, then run it once. A free Supabase project sleeps after a week with no activity, so do this soon after you notice.
- **Staging in a strange state.** Run **Staging** with reset ticked.

## Switching to a custom domain later

1. Vercel → Settings → Domains: add the domain and make it the production domain.
2. Redirect the old `vercel.app` address to it (Vercel's redirect option on the old domain), so saved host links keep working.
3. Supabase live → Authentication → URL Configuration: set **Site URL** to the new address.
4. Update `ALLOWED_ORIGINS` on live with `supabase secrets set` (new address, and the old one while it still redirects).
5. Cloudflare Turnstile: add the new hostname to the widget.
