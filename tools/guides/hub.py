import json, pathlib, html
from shell import head, HEADER, FOOTER, ROOT, BASE

GUIDES = [
    ("why-the-scale-lies", "Why the scale lies",
     "You cannot gain a kilo of fat overnight. What you actually gained, and the number to read instead of the one on the display."),
    ("what-you-actually-burn", "What you actually burn in a day",
     "The calculator gave you an average of people resembling you. Where that number comes from, and how to measure your own."),
    ("how-wrong-is-your-calorie-count", "How wrong is your calorie count?",
     "Labels carry a tolerance, portions get underestimated, and the handful while cooking never gets logged. Why it still works."),
    ("logging-food-you-didnt-cook", "Logging food you didn't cook",
     "No label, no scales, someone else's portions. How to log a meal out without giving up on the week."),
    ("why-the-weight-stopped-moving", "Why the weight stopped moving",
     "Three causes of a plateau, each needing a different response — and one of them is to do nothing."),
]

URL = f"{BASE}/guides/"
TITLE = "Guides — QuicKcals"
DESC = ("Plain explanations of the things a food diary never tells you: why the scale swings, "
        "what you actually burn, how wrong a calorie count is, and what a plateau really means.")

ld = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "CollectionPage",
            "name": "QuicKcals Guides",
            "description": DESC,
            "url": URL,
            "inLanguage": "en-GB",
        },
        {
            "@type": "ItemList",
            "itemListOrder": "https://schema.org/ItemListUnordered",
            "numberOfItems": len(GUIDES),
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": name,
                 "url": f"{BASE}/guides/{slug}"}
                for i, (slug, name, _) in enumerate(GUIDES)
            ],
        },
    ],
}

cards = "\n".join(f'''          <a class="guide-card" href="/guides/{slug}">
            <h2>{html.escape(name)}</h2>
            <p>{html.escape(blurb)}</p>
          </a>''' for slug, name, blurb in GUIDES)

doc = head(title=TITLE, description=DESC, url=URL, jsonld=ld)
doc += HEADER
doc += f'''      <div class="guide-index">
        <div class="guide-index-head">
          <h1>The things a food diary never explains</h1>
          <p>
            Why the scale moves when your diet didn't, what your body actually
            spends in a day, and how wrong a calorie count really is. Written
            by the people who build QuicKcals, and honest about the parts
            nobody can measure precisely.
          </p>
        </div>
        <div class="guide-cards">
{cards}
        </div>
      </div>
'''
doc += FOOTER + "</html>\n"
out = ROOT / "guides" / "index.html"
out.write_text(doc)
print("hub written:", out)
