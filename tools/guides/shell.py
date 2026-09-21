"""The page shell every guide shares. Authoring helper — the HTML it writes is
what ships; this is not a build step."""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parents[2] / "public"
BASE = "https://quickcals.com"

# One author, named, in one place. A byline that says a person and structured
# data that says nobody is worse than either alone — weight loss is the sort of
# subject where a reader is entitled to know who is talking.
AUTHOR = "Elliot Clifford"
AUTHOR_URL = f"{BASE}/about"

# When these were published. Real dates, and the same for all five because
# that is when they were written; a staggered set invented to look like a
# schedule would be the first dishonest thing on the site.
PUBLISHED = "2026-09-19"

# The AdSense publisher id, which is public by design: it sits in ads.txt, and
# on every page of every site that runs AdSense. It is not a key and grants
# nothing — the account is identified by it, not authorised by it.
#
# Why a literal rather than config: these pages are static files served by
# sendFile, with no server-side templating to inject anything into, and the
# script has to be findable in the page source. AdSense's own review looks for
# this tag, and a tag written in by JavaScript after a fetch is a tag a
# reviewer may never see. It has to be in the HTML.
#
# There is no ad *unit* here on purpose. A unit needs a slot id, slot ids can
# only be created once an account is approved, and an <ins> carrying no slot
# is an invalid ad request rather than an empty space. So this is the script
# on its own: placement is Auto ads, switched on per-site from the AdSense
# dashboard, where the density is also somebody's decision rather than a
# constant in here. A fixed foot-of-article unit can replace it later; that is
# one line in this file and a rebuild.
#
# Must match public/ads.txt. A mismatch earns nothing and says nothing — the
# pages would ask one account for ads while the domain vouches for another.
# tests/seo.test.ts asserts the two agree.
ADSENSE_CLIENT = "ca-pub-4777766850308562"

ADSENSE_TAG = f'''    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>
'''

HEADER = '''  <body>
    <header class="lp-header">
      <div class="lp-wrap lp-header-inner">
        <a class="lp-brand" href="/">
          <img src="/icons/icon-192.png" alt="" width="30" height="30" />
          QuicKcals
        </a>
        <nav class="lp-nav">
          <a class="lp-nav-link" href="/guides/">Guides</a>
          <a class="lp-nav-link" href="/about">About</a>
          <a class="lp-cta" href="/?app=1">Open the app</a>
        </nav>
      </div>
    </header>
    <main>
'''

FOOTER = '''    </main>
    <footer class="lp-footer">
      <div class="lp-wrap lp-footer-inner">
        <span>&copy; 2026 QuicKcals</span>
        <nav class="lp-footer-legal">
          <a href="/guides/">Guides</a>
          <a href="/about">About</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="mailto:hello@quickcals.com">Contact</a>
        </nav>
      </div>
    </footer>
  </body>
'''

def head(*, title, description, url, jsonld):
    """The <title> carries the brand; the share titles and the JSON-LD headline
    do not. A search result wants to say who this is, and a link pasted into a
    group chat already shows the site name underneath it — repeating it there
    just spends characters that the headline needed."""
    tab_title = title if title.endswith("QuicKcals") else f"{title} | QuicKcals"
    return f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(tab_title)}</title>
    <meta name="description" content="{html.escape(description)}" />
    <link rel="canonical" href="{url}" />
    <meta property="og:title" content="{html.escape(title)}" />
    <meta property="og:description" content="{html.escape(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{url}" />
    <meta property="og:image" content="{BASE}/icons/social-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="QuicKcals — the calorie diary that stops being work" />
    <meta property="og:site_name" content="QuicKcals" />
    <meta property="og:locale" content="en_GB" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{html.escape(title)}" />
    <meta name="twitter:description" content="{html.escape(description)}" />
    <meta name="twitter:image" content="{BASE}/icons/social-card.png" />
    <meta name="theme-color" content="#176B3A" />
    <link rel="icon" href="/icons/mark.svg" type="image/svg+xml" />
    <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=Montserrat:wght@500;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/guide.css" />
    <script src="/attribution.js"></script>
{ADSENSE_TAG}    <script type="application/ld+json">
{json.dumps(jsonld, indent=6, ensure_ascii=False)}
    </script>
  </head>
'''

def article_ld(*, title, description, url):
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                "headline": title,
                "description": description,
                "url": url,
                "inLanguage": "en-GB",
                "isAccessibleForFree": True,
                "author": {"@type": "Person", "name": AUTHOR, "url": AUTHOR_URL},
                "datePublished": PUBLISHED,
                "dateModified": PUBLISHED,
                "publisher": {"@type": "Organization", "name": "QuicKcals",
                              "url": f"{BASE}/", "logo": f"{BASE}/icons/icon-512.png"},
                "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "QuicKcals", "item": f"{BASE}/"},
                    {"@type": "ListItem", "position": 2, "name": "Guides", "item": f"{BASE}/guides/"},
                    {"@type": "ListItem", "position": 3, "name": title},
                ],
            },
        ],
    }

CLOSER = '''
        <div class="guide-end">
          <h2>QuicKcals does this arithmetic for you</h2>
          <p>
            It reads the trend rather than the day, works out what you actually
            burn from your own weight data, and tells you which figures are
            measured and which are estimated. Free, no card.
          </p>
          <a class="lp-cta" href="/?app=1&amp;signup=1">Start a free diary</a>
        </div>

        <div class="guide-note">
          <strong>This is not medical advice.</strong>
          <p>
            It is general information from people who build a food diary. If
            you are managing a medical condition, are pregnant, are under 18,
            or have a history of disordered eating, talk to a doctor or a
            registered dietitian before changing how you eat.
          </p>
        </div>
'''

def next_block(items):
    lis = "\n".join(
        f'''            <li>
              <a href="{href}">{html.escape(name)}</a>
              <span>{html.escape(blurb)}</span>
            </li>''' for href, name, blurb in items)
    return f'''
        <nav class="guide-next">
          <h2>Read next</h2>
          <ul>
{lis}
          </ul>
        </nav>
'''

def write_guide(*, slug, title, description, standfirst, meta, body, nexts):
    url = f"{BASE}/guides/{slug}"
    published_label = "19 September 2026"
    doc = head(title=title, description=description, url=url,
               jsonld=article_ld(title=title, description=description, url=url))
    doc += HEADER
    doc += f'''      <article class="guide">
        <a class="guide-eyebrow" href="/guides/">Guides</a>
        <h1>{html.escape(standfirst["h1"])}</h1>
        <p class="guide-standfirst">{standfirst["lede"]}</p>
        <p class="guide-meta">
          Written by <a href="/about">{AUTHOR}</a> &middot;
          <time datetime="{PUBLISHED}">{published_label}</time> &middot; {meta}
        </p>
{body}
{CLOSER}
{next_block(nexts)}
      </article>
'''
    doc += FOOTER + "</html>\n"
    out = ROOT / "guides" / f"{slug}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)
    return out
