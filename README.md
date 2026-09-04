# Match Week Food Diary

A deliberately rough food log for a Man v Fat Football habit. Log a meal by
text and/or photo, Claude turns it into a short label + one best-guess kcal
number, entries are grouped into "match weeks" running from a configurable
weekly rollover (Monday 17:00 by default) to the next, and a clean PDF report
is generated and uploaded to Google Drive automatically once each week's
rollover passes.

No macros, no ranges, no guilt — single numbers, edit anything that looks
wrong.

Multiple people can use the same deployment: each person creates their own
account (sign up with a username/password, or "Sign in with Google" if
that's configured — see below), sees only their own entries, and sets their
own weekly rollover day/time under the ⚙ settings icon — useful since e.g.
one person's week might run Monday 17:00 and another's Wednesday 09:00.

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
hosted DB: a small personal tool for a couple of people doesn't need that
surface area, and an in-process cron only works at all if the process is
guaranteed to be alive at the boundary — see "Hosting" below.

## Quick start (local dev)

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY at minimum
npm run db:migrate          # creates data/dev.db and applies the schema
npm run dev                 # http://localhost:3000
```

Open the URL on your phone (same network, or via a tunnel) — sign up with a
username/password on first visit (anyone can create an account; there's no
invite step). The very first account ever created on a deployment claims any
match weeks logged before accounts existed, so pre-multi-user history isn't
orphaned. Without Google credentials set, reports still generate locally;
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
| `GOOGLE_SIGNIN_CLIENT_ID` | Optional, separate from the Drive client above. Enables the "Sign in with Google" button. Leave unset to keep username/password as the only sign-in method. |
| `RESEND_API_KEY` / `MAIL_FROM` | Optional. Enables "Forgotten your password?" to email a one-hour reset link. Unset, the app says so plainly and falls back to signing in with a linked Google account. |
| `ERROR_WEBHOOK_URL` | Optional Slack-style incoming webhook. Every recorded server error is POSTed as `{"text": "..."}`. Errors are stored and shown in Settings → Diagnostics either way. |
| `NUTRITIONIX_APP_ID` / `NUTRITIONIX_APP_KEY` | Optional. Adds restaurant and pub menus to food search, plus everyday foods that never came in a packet. Unset, search still covers the user's own diary and Open Food Facts — it just can't find anything off a menu. |
| `USDA_API_KEY` | Optional. Adds plain ingredients (FoodData Central), already stated per 100g. Unset, search has packets but no raw chicken breast. |

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

## "Sign in with Google" one-time setup (optional)

This is a separate OAuth client from the Drive one above — Drive's is a
"TVs and Limited Input devices" client (device-code flow, no browser
origin), which can't be used for a browser sign-in button. Skip this section
entirely to keep username/password as the only sign-in method; nothing else
in the app depends on it.

1. In the same (or a different) Google Cloud project, under **APIs &
   Services → Credentials**, create an OAuth client of type **Web
   application**.
2. Add this app's URL (e.g. `https://match-week-food-diary.fly.dev`, and
   `http://localhost:3000` for local dev) under **Authorized JavaScript
   origins**. No redirect URI is needed — the button flow doesn't use one.
3. Put the client ID in `.env` as `GOOGLE_SIGNIN_CLIENT_ID` (no secret needed;
   the server only verifies ID tokens, it doesn't exchange a code). For the
   GitHub Actions deploy path, add it as a repo secret of the same name
   instead.
4. The first time someone uses the button, an account is created
   automatically from their Google profile (no separate signup step, no
   password) — a username is derived from their email and de-duplicated
   against existing accounts. Signing in with Google again later matches the
   same Google account, not the email, so it's unrelated to any
   username/password account that happens to share that email.

## Hosting

**Recommendation: a single always-on small VM, not serverless.** The brief
asked about Fly.io / a tiny VPS / scheduled GitHub Actions — reasoning:

- The report job needs to run unattended at a specific wall-clock moment
  every week. A scheduled GitHub Action is the obvious-looking choice but
  it has no persistent disk of its own, so it would need an external DB
  (Turso/Neon/etc) and an external place to run the web form anyway — at
  that point you have *more* moving parts, not fewer, for a tool this small.
- A serverless function (Vercel/Lambda-style) solves hosting the form but
  cron-on-a-timer there is itself just another scheduled trigger pointed
  back at the function, and you still need an external DB since serverless
  filesystems aren't persistent. Same complexity tradeoff as above.
- One small always-on instance with a persistent volume lets SQLite,
  uploaded photos, and an in-process `node-cron` all just live in one place.
  It's the smallest number of accounts/services/secrets to maintain for a
  tool a handful of people use.

`Dockerfile` + `fly.toml` are included as a concrete instance of this
(Render or Railway work the same way — single service, one volume). The one
setting that actually matters wherever you deploy: **the instance must not
auto-suspend on idle.** If the platform spins the process down between
requests (Fly's default autostop, Render's free-tier sleep), the in-process
cron simply never fires at each user's rollover time. `fly.toml` sets
`auto_stop_machines = false` / `min_machines_running = 1` for this reason —
keep the equivalent "always on" setting wherever you deploy.

```bash
fly launch --no-deploy        # creates the app from fly.toml, skip the wizard's deploy
fly volumes create food_diary_data --size 1
fly secrets set ANTHROPIC_API_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... GOOGLE_SIGNIN_CLIENT_ID=...
fly deploy
```

(`GOOGLE_SIGNIN_CLIENT_ID` is optional — omit it to leave "Sign in with
Google" disabled.)

Alternatively, `.github/workflows/deploy.yml` does all four of the above on
every push to `main` (and on manual trigger), using `flyctl` on GitHub's
runners instead of a local machine — useful if you'd rather not install
`flyctl` anywhere yourself. It needs `FLY_API_TOKEN` (from Fly's dashboard
under Account → Access Tokens) plus the five secrets already listed above
set once under **Settings → Secrets and variables → Actions** (leave
`GOOGLE_SIGNIN_CLIENT_ID` unset there too if you don't want the button).

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

The rule: a week is `[rollover, following rollover)` in `TIMEZONE`, where the
rollover weekday + time is configurable per user (`weekStartWeekday` /
`weekStartHour` / `weekStartMinute` on `User`, defaulting to Monday 17:00 —
`DEFAULT_WEEK_START`). An entry timestamped one minute before the rollover
belongs to the closing week; the rollover instant exactly starts the new one.
Every entry gets assigned a `MatchWeek` row (created on first use, scoped to
that user) via `findOrCreateMatchWeek`, so weeks are first-class rows in the
DB, not a display-time calculation.

## Screens

Five, reachable from a bottom tab bar at every width:

- **Today** — the landing screen, and where logging happens. A ring of the
  day's calories against whatever it's being measured by, the macro rows,
  the log form, water, WHOOP recovery and sleep, and a short read on the day
  so far. Everything on it comes from one call (`GET /api/stats/today`): this
  is the first thing anyone sees, and five round trips means five chances to
  render half a page.
- **My week** — the week's picture: the form guide, the week total and daily
  breakdown, the calorie balance, exercise and the full diary.
- **Food Library**, **Stats**, **Settings** as before.

`navTo()` owns which screen is showing. Each screen used to hide the others
from its own open/close pair, which with five destinations would have meant
writing "hide the other four" five times — and any one of them getting it
wrong shows two screens at once.

Logging lives on Today rather than being duplicated: a mutation refreshes
only the tab you are actually on (`refreshCurrentView()`), because `navTo()`
reloads each tab as you arrive at it anyway.

## Week styles

Two shapes, both driven by the one stored rollover time rather than a separate
flag that could drift out of step with it:

- **From a set time** (the original): Monday 17:00 -> Monday 17:00. Touches
  eight calendar dates, because it opens and closes part-way through a
  Monday, so each of those counts as half a day and a full week still totals
  seven.
- **Whole days**: Monday 00:00 -> Monday 00:00, i.e. Mon–Sun. Seven dates, no
  split days, every day counts once.

`isWholeDayWeek()` derives which is which from the week's own start instant,
so `matchWeekCalendarDays()` and `weightedDaysLogged()` can't disagree with
the boundary they're describing. Before that existed, a midnight rollover
would still have halved the opening day and counted a phantom eighth date —
a fully logged week would have reported six.

Changing the rollover re-files every entry and exercise into the weeks the
new setting implies (`src/refileMatchWeeks.ts`). Entries are attached to a
MatchWeek row keyed by its exact boundaries, so without this the data would
all still be there but the diary would show an empty week, which reads
exactly like having lost it. Cached weekly reviews are cleared at the same
time, since they describe a slicing that no longer exists; a week holding a
report already filed in Drive is never deleted, even once empty.

The week's date range is formatted server-side, in `TIMEZONE`. The browser
formatting it from the boundary instants agreed with the app only by luck:
17:00 local is 16:00 UTC, the same date either way, but a whole-day week
starts at local midnight and lands on the previous date for any viewer behind
the app's timezone.

## What a day is measured against

In descending order of authority:

1. **Measured burn** from WHOOP, per day.
2. **The user's own daily calorie target**, if they've set one. A figure
   someone typed in is a statement of what they're aiming at, and showing
   them a formula's guess instead ignores what they told us.
3. **A Mifflin-St Jeor estimate** from body stats.

The kind matters as much as the number, so `dailyReference()` returns both: a
burn figure supports "deficit" and a projected weight change, a target only
supports "under" and "over". Against a target the balance widget relabels
itself and drops the kilogram projection entirely rather than predicting the
scale from what someone meant to eat.

## Weekly report job

`src/jobs/scheduler.ts` fires `closeMatchWeeksNeedingReport()` every hour, and
once more 5s after process startup to catch up anything missed while the
process was down (deploy, crash, restart). It's hourly rather than a single
weekly tick because each user has their own rollover weekday/time now —
running more often keeps every user's report within an hour of their own
boundary instead of only being timed for one user. It queries for any
`MatchWeek` whose `endsAt` has passed but has no report yet — across all
users, processing more than one if several were missed — generates the PDF,
uploads it to Drive as `Food Diary/<week-start-date>.pdf`, and stamps the row
so it's never regenerated automatically. A failure on one week doesn't block
others, and leaves that week's `reportGeneratedAt` null so the next tick
retries it.

## Macros

Off by default, and the whole feature is gated behind `User.macroMode` being
set — with it null the app tracks calories only, exactly as it did before
macros existed.

Targets can be set two ways, and both are stored as given rather than
converted into one canonical form (see `src/macros.ts`). Grams are a fixed
figure whatever the calorie target does; percentages are a share of it, so
raising the calorie target raises every macro with it. Storing the derived
grams for a percentage target instead would go stale the moment that target
changed, which is why `User` carries both sets of columns.

In gram mode each macro also carries its own comparison — `min` (at least),
`max` (at most) or `eq` (about) — because the three are rarely wanted the
same way round: protein is usually a floor you're clearing, carbs or fat a
ceiling you're staying under. `macroProgress()` is the one place a macro is
judged against its target, and it separates the verdict from whether the
verdict is *good*: 210g against a 180g figure is a full bar either way, but
it's a success for a floor and a failure for a ceiling. The diary mirrors
that function in JavaScript to render without a round trip; the TypeScript
one is the source of truth.

A blank target means that macro isn't tracked and its row is left off the
diary entirely — a protein floor on its own is a valid setup. A stored `0`
reads the same way, since a 0g target can only ever say "0g over".
Percentages are always `eq`: they have to sum to 100, so "at least 40%
protein" can't be satisfied without saying what gives way.

`Entry.proteinG/carbsG/fatG` are nullable on purpose. Null means "nobody
worked it out" — every row logged before this shipped — which is a different
thing from a food genuinely containing none, and the diary distinguishes
them: a day mixing the two says its totals are short rather than presenting a
partial sum as complete. `sumMacros()` is the only place that judgement is
made.

Figures come from three sources, in descending order of trust: real per-100g
data off a barcode (Open Food Facts), a number typed by the user, and the
model's estimate. The estimator applies the same 12% buffer to the macros as
to the calories — the under-reporting it corrects for is under-reported
*food*, so the fat in an unmentioned splash of oil is missing too — and caps
each macro at what the stated calories could physically hold, since a model
asked for four numbers at once will occasionally put 90g of protein in a
300 kcal item.

## Backups

Everything the app has recorded lives in one SQLite file on one volume, so
`src/jobs/backup.ts` runs nightly at 03:30 local (and once ~30s after boot, so
a machine that never reaches 03:30 still leaves a copy). It uses SQLite's
`VACUUM INTO`, which writes a complete, consistent copy without locking out
writers — a plain file copy of a WAL-mode database can't promise that.

Copies go to `data/backups/`, the newest 14 are kept, and if Drive is
configured the latest is uploaded there too. That last part is the bit that
matters: a backup sitting on the volume it exists to survive isn't one.
Settings → Diagnostics shows when the last backup ran and whether it went
off-box, and has a "Back up now" button.

`src/jobs/cleanupUploads.ts` runs at 03:45, straight after, and deletes photos
in `data/uploads/` that no entry, exercise or progress photo references any
more — skipping anything under 24 hours old, since an upload written moments
before its row is created is indistinguishable from an orphan.

## Rate limiting

Every AI estimate costs money on the operator's card, so `src/rateLimit.ts`
puts a ceiling in front of the model call: 12 a minute and 300 a day per user,
with barcode scans and typed figures exempt because they cost nothing. Login
attempts are throttled per username *and* source address — per username alone
would let anyone lock an account out by failing at it — and password-reset
requests per address.

It's an in-memory sliding window, which suits a single Fly machine: the
failure it exists to stop is a runaway loop within one process lifetime, not a
patient attacker pacing requests across restarts.

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

## Meal slots and editing day/meal

Every entry gets a `mealType` — `breakfast` / `lunch` / `dinner` / `snack` —
defaulted from local time-of-day at creation (`src/mealType.ts`'s
`inferMealType`: 04:00–10:59 breakfast, 11:00–14:59 lunch, 17:00–21:59
dinner, everything else snack). The "This week" list groups entries by day
then by meal slot in that fixed order.

Tap **Edit** on any entry to change its label, kcal, meal slot, or the day
it's logged against. Changing the day keeps the original time-of-day and
only swaps the calendar date, recomputing which `MatchWeek` the entry
belongs to via `findOrCreateMatchWeek` — so moving an entry across a
Monday-17:00 boundary correctly reassigns it to the other week's totals.

## What's out of scope (per the brief, intentionally)

Macro/micronutrient tracking, multi-user accounts, exact calorie accuracy.
This is a vibe-check, not a medical tool.

## Tests

```bash
npm test
```

Currently covers the match-week boundary logic (the highest-value thing to
get right, since everything else assumes it's correct).
