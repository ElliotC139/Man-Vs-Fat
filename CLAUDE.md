# Working on QuicKcals

## Talking to Elliot

**Always include the link.** Any time an instruction points at a page — a
dashboard, a DNS record, a Search Console report, a PR, a page on the site —
give the URL inline, as a clickable link. "AdSense → Privacy & messaging" is
not an instruction, it is a description of one.

Where a deep link is uncertain, link the reliable entry point and name the
path from there. A link that 404s is worse than an honest two-step.

## The domain

See `DOMAIN.md`.

## Public pages

`public/guides/*.html`, `public/guides/index.html` and `public/about.html` are
**generated**. Edit `tools/guides/*.py` and run `python3 tools/guides/build.py`
— never hand-patch the HTML. See `tools/guides/README.md`.

`public/landing.html` is hand-authored and shares no generator, so anything
added to the shared shell has to be added there too.

## Deploys

Push to `main` deploys to Fly. `main` is protected and requires the `check`
status, so everything goes through a PR.

After a squash merge the working branch keeps its pre-squash commits and goes
`mergeable_state: dirty`, which stops GitHub creating a merge ref and so stops
CI running at all. Reset the branch onto the new `main` straight after every
merge rather than discovering it next time.

Bump `VERSION` in `public/sw.js` on any deploy that changes a file in
`SHELL_ASSETS`.

## Secrets

`fly secrets set` from a terminal deploys immediately. **The Fly dashboard does
not** — saving a secret there only stages it, and it reaches the running
machines when you press **Deploy Secrets**. A staged secret shows an amber dot
beside its name in the list, and that dot is the only sign; the name and digest
look identical either way. Symptom is a feature that stays switched off while
the secret plainly exists.

## Food data sources

Three providers, two of which need keys (`src/foodSearchProviders.ts`):

- **Open Food Facts** — packaged food and barcodes. Free, no key, always on.
- **USDA** (`USDA_API_KEY`) — plain ingredients. Free key.
- **Nutritionix** (`NUTRITIONIX_APP_ID` + `NUTRITIONIX_APP_KEY`) — restaurant
  and pub menus. Paid, and **both** must be set or the "Eating out" tab stays
  dark.

`GET /api/food-search?q=` (empty query) returns `sources: {menus, ingredients}`
without touching the database, which is the quickest way to see what is
actually switched on in a running deployment.

A provider that throws is swallowed by `safely()` so one bad source cannot kill
a whole search — it logs and returns nothing. So "no results from X" and "X is
not configured" look identical from the app; check the flags above, then the
logs.
