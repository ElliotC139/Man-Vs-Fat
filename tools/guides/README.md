# The guides, and the pages that share their shell

`public/guides/*.html` are generated files. This is what generates them.

    cd tools/guides && python3 build.py

It writes straight into `public/guides/`. There is no build step in this
project and this is deliberately not one — the committed HTML is what ships,
and this exists so those files can be *rebuilt* rather than hand-patched.

Which matters more than it sounds. Six pages share a head, a header, a footer,
a call to action and a medical disclaimer. Editing any of that by hand means
editing it six times and getting it right six times, and the first thing to
drift is always the one nobody re-checks.

- `shell.py` — the head, chrome, byline, closing card and disclaimer.
- `g1.py`–`g5.py` — one guide each: metadata and body copy.
- `hub.py` — `/guides/`, the index.
- `about.py` — `/about`, which shares the same shell.
- `build.py` — runs all of them.

`tests/seo.test.ts` holds the output to its promises: a minimum length, a
byline, a date, a named author in the structured data, the disclaimer, and
links onward to other guides.
