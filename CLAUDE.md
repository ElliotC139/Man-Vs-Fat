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
