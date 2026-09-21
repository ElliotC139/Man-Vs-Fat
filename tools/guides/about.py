import json, html
from shell import head, HEADER, FOOTER, ROOT, BASE, AUTHOR

URL = f"{BASE}/about"
TITLE = "About QuicKcals"
DESC = ("Who builds QuicKcals, why it exists, and what it deliberately doesn't claim. "
        "Written and run by Elliot Clifford — not a dietitian, and the app is built to say so.")

ld = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "AboutPage",
            "name": TITLE,
            "description": DESC,
            "url": URL,
            "inLanguage": "en-GB",
            "mainEntity": {"@id": f"{BASE}/#organization"},
        },
        {
            "@type": "Organization",
            "@id": f"{BASE}/#organization",
            "name": "QuicKcals",
            "url": f"{BASE}/",
            "logo": f"{BASE}/icons/icon-512.png",
            "founder": {"@type": "Person", "name": AUTHOR},
            "email": "hello@quickcals.com",
            "description": DESC,
        },
        {
            "@type": "Person",
            "name": AUTHOR,
            "url": URL,
            "jobTitle": "Founder and developer, QuicKcals",
        },
    ],
}

BODY = '''
        <p>
          QuicKcals is a food diary, built and run by one person in the UK. My
          name is Elliot Clifford. You can reach me at
          <a href="mailto:hello@quickcals.com">hello@quickcals.com</a> and it
          comes to me, not to a helpdesk.
        </p>

        <h2>Who I am, and what I'm not</h2>

        <p>
          I'm a software developer, not a dietitian, a nutritionist or a
          doctor. I have no clinical qualification of any kind, and nothing on
          this site should be read as though I do.
        </p>

        <p>
          What I do have is the problem. I've used food diaries, got bored of
          them, and stopped — repeatedly, the way most people do. The app
          exists because the logging is the part that fails, not the arithmetic.
        </p>

        <p>
          So the writing here sticks to things that are well established and
          checkable — that a kilogram of body fat is worth roughly 7,700
          calories, that nutrition labels carry a tolerance, that people
          consistently underestimate portions — and says plainly where the
          honest answer is "nobody can measure that precisely". Where a
          question is genuinely medical, the guides say so and point at a
          doctor or a registered dietitian rather than having a go.
        </p>

        <div class="guide-note">
          <strong>If you want advice about your own health, ask a professional.</strong>
          <p>
            That goes double if you're managing a medical condition, are
            pregnant, are under 18, or have any history of disordered eating. A
            food diary is a record. It isn't care, and I'm not qualified to
            provide any.
          </p>
        </div>

        <h2>Why the app is built the way it is</h2>

        <p>
          One idea runs through all of it: <strong>say which numbers are known
          and which are guessed.</strong>
        </p>

        <p>
          Anything read from a barcode or a food database is marked verified.
          Anything worked out by the AI from a photo or a description is marked
          an estimate, itemised, with the portion it assumed shown so you can
          correct the part that's wrong instead of abandoning the whole entry.
          A calorie count is never as precise as four digits make it look, and
          an app that pretends otherwise is training you to trust the wrong
          thing.
        </p>

        <p>
          The same rule applies to what QuicKcals claims it can do. It does not
          sync with Apple Health or Android's Health Connect, because no
          website can read either — so instead it reads the export file those
          apps already produce. That distinction cost me a feature on the
          marketing page. It was the right trade.
        </p>

        <h2>How it makes money</h2>

        <p>
          Free accounts are funded by advertising. Paid plans are
          &pound;4.99 and &pound;9.99 a month and carry no ads at all, which is
          the whole reason the free tier has them.
        </p>

        <p>
          Nothing you log is sold, shared, or used to target advertising at
          you, and your diary is never used to train a model. That's stated
          properly in the <a href="/privacy.html">privacy policy</a>, and if
          you'd rather just take everything and leave, Settings &rarr; Export
          hands you the lot as a file without asking anybody.
        </p>

        <h2>Corrections</h2>

        <p>
          If something here is wrong, tell me and I'll fix it and say that I
          did. <a href="mailto:hello@quickcals.com">hello@quickcals.com</a>.
          Signed-in users can also use Settings &rarr; Suggest an update, which
          comes to the same place with a bit more context attached.
        </p>
'''

doc = head(title=TITLE, description=DESC, url=URL, jsonld=ld)
doc += HEADER
doc += f'''      <article class="guide">
        <a class="guide-eyebrow" href="/">QuicKcals</a>
        <h1>About QuicKcals</h1>
        <p class="guide-standfirst">
          A food diary built by one person, which is honest about what it
          knows, what it estimates, and what it has no business telling you.
        </p>
        <p class="guide-meta">Last updated <time datetime="2026-09-21">21 September 2026</time></p>
{BODY}

        <div class="guide-end">
          <h2>Try it, then decide</h2>
          <p>
            Free, no card, and everything you log stays yours. If you never pay
            a penny, the diary still works.
          </p>
          <a class="lp-cta" href="/?app=1&amp;signup=1">Start a free diary</a>
        </div>
      </article>
'''
doc += FOOTER + "</html>\n"
out = ROOT / "about.html"
out.write_text(doc)
print("about written:", out)
