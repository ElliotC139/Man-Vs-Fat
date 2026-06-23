# Match Week Food Diary

A deliberately rough food log for a Man v Fat Football habit. Log a meal by
text and/or photo, Claude turns it into a short label + one best-guess kcal
number, entries are grouped into Monday 17:00 → Monday 17:00 "match weeks,"
and every Monday at 17:00 a clean PDF report is generated and uploaded to
Google Drive automatically.

No macros, no ranges, no guilt — single numbers, edit anything that looks
wrong.

## Stack

One small Node/TypeScript service. No separate cron infra, no separate
database service, no build step in production (runs straight off `tsx`).

- **Express** — web form + JSON API
- **SQLite via Prisma** — single file, survives in a mounted volume
- **`@anthropic-ai/sdk`** — text/photo → `{label, kcal}`
- **`pdfkit`** — the weekly report
- **`node-cron`** (in-process) — fires the report job at the week boundary
- **`googleapis`** — uploads the PDF to Drive

Why one process instead of e.g. a serverless function + external cron +
hosted DB: a personal, single-user tool doesn't need that surface area, and
an in-process cron only works at all if the process is guaranteed to be
alive at the boundary — see "Hosting" below.

## Quick start (local dev)

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY at minimum
npm run db:migrate          # creates data/dev.db and applies the schema
npm run dev                 # http://localhost:3000
```

Open the URL on your phone (same network, or via a tunnel) — the form is the
whole UI. Without Google credentials set, reports still generate locally;
they just won't upload (see logs).

To preview a report without waiting for Monday:

```bash
npm run report:run -- --current   # writes ./<date>-preview.pdf, uploads too if Drive is configured
```

## Environment variables

See `.env.example` for the full list with comments. The essentials:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Vision-capable Claude model does the estimation. |
| `TIMEZONE` | IANA zone the Mon 17:00 boundary is anchored to. Defaults to `Europe/London`. |
| `DATABASE_URL` | SQLite file path. **Relative paths resolve against `prisma/schema.prisma`'s directory, not the repo root** — that's why the default is `file:../data/dev.db` rather than `file:./data/dev.db`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Drive upload. Leave unset to run without Drive (reports generate but stay local + log a warning). |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional. If unset, the app finds-or-creates a "Food Diary" folder once and caches its id in the DB. |

## Google Drive one-time setup

1. In a Google Cloud project, enable the **Drive API** and create an OAuth
   client of type **TVs and Limited Input devices**. Put its client
   ID/secret in `.env`.
2. Run `npm run google:auth`. It uses the OAuth **Device Authorization
   Grant**, not a localhost redirect — deliberately, since this script may
   run somewhere other than the machine whose browser you're using (e.g. a
   remote box or container). It prints a short code and a URL; open the URL
   on any device, sign in with the Google account reports should land in,
   and enter the code. The script polls in the background and prints a
   `GOOGLE_REFRESH_TOKEN` line to paste into `.env` once you approve.
3. **Gotcha:** on the OAuth consent screen, set publishing status to
   **"In production"** (you can leave it unverified — you'll just click
   through a "Google hasn't verified this app" warning once during step 2).
   While a consent screen is in **"Testing"** status, Google expires refresh
   tokens after 7 days regardless of anything in this code, which would
   silently break uploads a week after setup. "In production" + unverified
   does not have that expiry for the scope used here (`drive.file`, which
   only grants access to files this app creates — not your whole Drive).

## Hosting

**Recommendation: a single always-on small VM, not serverless.** The brief
asked about Fly.io / a tiny VPS / scheduled GitHub Actions — reasoning:

- The report job needs to run unattended at a specific wall-clock moment
  every week. A scheduled GitHub Action is the obvious-looking choice but
  it has no persistent disk of its own, so it would need an external DB
  (Turso/Neon/etc) and an external place to run the web form anyway — at
  that point you have *more* moving parts, not fewer, for a single-user
  tool.
- A serverless function (Vercel/Lambda-style) solves hosting the form but
  cron-on-a-timer there is itself just another scheduled trigger pointed
  back at the function, and you still need an external DB since serverless
  filesystems aren't persistent. Same complexity tradeoff as above.
- One small always-on instance with a persistent volume lets SQLite,
  uploaded photos, and an in-process `node-cron` all just live in one place.
  It's the smallest number of accounts/services/secrets to maintain for a
  tool only one person uses.

`Dockerfile` + `fly.toml` are included as a concrete instance of this
(Render or Railway work the same way — single service, one volume). The one
setting that actually matters wherever you deploy: **the instance must not
auto-suspend on idle.** If the platform spins the process down between
requests (Fly's default autostop, Render's free-tier sleep), the in-process
cron simply never fires at 17:00. `fly.toml` sets
`auto_stop_machines = false` / `min_machines_running = 1` for this reason —
keep the equivalent "always on" setting wherever you deploy.

```bash
fly launch --no-deploy        # creates the app from fly.toml, skip the wizard's deploy
fly volumes create food_diary_data --size 1
fly secrets set ANTHROPIC_API_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=...
fly deploy
```

Alternatively, `.github/workflows/deploy.yml` does all four of the above on
every push to `main` (and on manual trigger), using `flyctl` on GitHub's
runners instead of a local machine — useful if you'd rather not install
`flyctl` anywhere yourself. It needs five repo secrets set once under
**Settings → Secrets and variables → Actions**: `FLY_API_TOKEN` (from Fly's
dashboard under Account → Access Tokens) plus the four secrets already
listed above.

## Input method

Built: a mobile-friendly web form (text + photo, big touch targets, shows
the estimate immediately so you can correct it on the spot). That alone gets
logging down to "open a bookmarked page, type one line, tap" — a few
seconds, which was the actual bar in the brief.

Deliberately **not** built yet: a Telegram bot / share-sheet shortcut, even
though the brief flagged it as a nice-to-have. Reasoning: it's a genuinely
small addition *given the API already exists* — `POST /api/entries` already
accepts `text` and/or a `photo` file and does everything else (estimate,
match-week assignment, storage), so a Telegram bot is ~50 lines forwarding
`message.text` / `message.photo` to that same endpoint. It didn't make the
first cut only because the core pipeline (estimation → storage → match week
→ PDF → Drive) needed to exist and be correct first. Telegram over
WhatsApp/SMS specifically, when you do add it: no business-account
verification step, a simple long-polling or webhook bot API, and free.

## How the match week boundary works

`src/matchWeek.ts` is the one piece of this app that has to be exactly
right, since the report, the averages, and "which week does this entry
belong to" all key off it — so it's covered by `tests/matchWeek.test.ts`,
including the BST/GMT transition weeks (a Monday where the UK's UTC offset
itself changes is the actual edge case that breaks naive implementations).

The rule: a week is `[Monday 17:00, following Monday 17:00)` in `TIMEZONE`.
An entry timestamped Monday 16:59 belongs to the closing week; Monday 17:00
exactly starts the new one. Every entry gets assigned a `MatchWeek` row
(created on first use) via `findOrCreateMatchWeek`, so weeks are first-class
rows in the DB, not a display-time calculation.

## Weekly report job

`src/jobs/scheduler.ts` fires `closeMatchWeeksNeedingReport()` every Monday
17:00, and once more 5s after process startup to catch up anything missed
while the process was down (deploy, crash, restart). It queries for any
`MatchWeek` whose `endsAt` has passed but has no report yet — processing
more than one if several were missed — generates the PDF, uploads it to
Drive as `Food Diary/<week-start-date>.pdf`, and stamps the row so it's
never regenerated automatically. A failure on one week doesn't block
others, and leaves that week's `reportGeneratedAt` null so the next tick
retries it.

## Estimation edge cases

`src/estimate.ts` asks the model for a JSON array of `{label, kcal}` items
rather than one combined object, so a single submission describing several
distinct foods/snacks/drinks ("chicken stir fry with rice, small handful of
crisps") becomes one diary entry per item — while the components of a single
dish ("chicken stir fry with rice") still collapse into one item, since
that's one meal, not three. `src/routes/entries.ts` creates one `Entry` row
per returned item, all in a single transaction so a submission is either
fully logged or not at all.

The Anthropic call is retried (with backoff) before giving up, to absorb the
transient network/stream errors seen occasionally in production — the kcal
number should come from the model, not from typing one in by hand. Only once
every retry is exhausted does an entry fall back to `kcal: null` and a
placeholder label, rather than being dropped. The web form and report both
render `null` as `—` and exclude it from totals (with a footnote on the PDF
if it happens), and the inline edit UI lets you fill it in immediately.

## What's out of scope (per the brief, intentionally)

Macro/micronutrient tracking, multi-user accounts, exact calorie accuracy.
This is a vibe-check, not a medical tool.

## Tests

```bash
npm test
```

Currently covers the match-week boundary logic (the highest-value thing to
get right, since everything else assumes it's correct).
