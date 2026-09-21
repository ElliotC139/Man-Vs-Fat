from shell import write_guide

body = '''
        <p>
          A food diary presents every entry to four significant figures. 486
          kcal. 32g of protein. The precision is real in the sense that the
          arithmetic was done correctly, and largely fictional in the sense
          that the inputs were never that good.
        </p>
        <p>
          This is not an argument against counting. It is an argument for
          knowing which parts of the number to trust, because that turns out to
          decide whether counting works for you at all.
        </p>

        <h2>The label is a tolerance, not a measurement</h2>

        <p>
          Packaged food is the most trustworthy thing in your diary, and it is
          still approximate. Nutrition labels are produced from a mix of
          laboratory analysis and calculation from recipe, then checked against
          a permitted tolerance band rather than an exact figure. The bands are
          not tiny — guidance in the range of plus or minus a fifth on energy
          is commonly cited for many products.
        </p>

        <p>
          There is a real reason for that. A batch of crisps is fried in oil
          whose uptake varies; a loaf's moisture varies with the day. A
          regulator demanding an exact figure would be demanding something food
          cannot deliver.
        </p>

        <p>
          So a 500 kcal ready meal is a ready meal that is probably somewhere
          near 500. That is fine. It is also worth knowing before you agonise
          over a 20-calorie difference between two yoghurts.
        </p>

        <h2>Where the error is actually large</h2>

        <p>
          Labels are the good case. The error in a real diary mostly comes from
          three other places.
        </p>

        <h3>Portions</h3>

        <p>
          "A bowl of pasta" covers a range of about two hundred calories. Eyeballing
          is worse than most people think, and it is worse in a consistent
          direction: portions of things we like get underestimated, and the
          error grows with the size of the serving. Scales fix this and almost
          nobody uses them forever — which is fine, as long as you know that
          the estimate is where the uncertainty lives.
        </p>

        <h3>Oil, butter, sauces and dressings</h3>

        <p>
          Fat is nine calories a gram and effectively invisible once it's in
          the pan. A tablespoon of olive oil is around 120 kcal. A "healthy"
          salad can carry more calories in its dressing than in everything
          else on the plate. Most large unexplained gaps in a diary are here.
        </p>

        <h3>The things that never get logged</h3>

        <p>
          The mouthful of the kids' dinner. Three chips off someone else's
          plate. The milk in four coffees. A handful of nuts while cooking.
          None of it feels like eating, and a few hundred calories a day of it
          is entirely normal.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">20-30%</span>
          <p>
            How much people typically underreport by, measured against
            objective methods. It is not dishonesty — it is portions and the
            bits that never felt like a meal. Expect to be in it.
          </p>
        </div>

        <h2>Why this doesn't sink the whole exercise</h2>

        <p>
          Here is the part that matters, and it is genuinely good news.
        </p>

        <p>
          If your logging is wrong by roughly the same amount every day, the
          error largely cancels out of the thing you actually use the diary
          for. You are not trying to learn the true calorie content of a
          shepherd's pie. You are trying to learn what happens to your weight
          when you eat a certain amount of food — and the diary's job is to
          give you a consistent unit of measurement, not a true one.
        </p>

        <p>
          Work out your maintenance level from your own logged intake and your
          own weight trend, and any systematic error is baked into both sides
          of that arithmetic. If you log 15% low, the maintenance figure you
          derive is 15% low too, and eating to it works exactly as intended.
          The numbers are wrong and the decisions are right.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">Consistent &gt; accurate</span>
          <p>
            A diary that's reliably 15% out is more useful than one that's
            perfect on weekdays and absent at weekends. The first has a
            correctable bias. The second has a hole.
          </p>
        </div>

        <p>
          Which reframes what a good diary is. Not the one with the most
          precise entries — the one you keep filling in on the bad days.
        </p>

        <h2>What to actually do about it</h2>

        <ul>
          <li>
            <strong>Be consistent before you're accurate.</strong> Same foods
            logged the same way, every day, including the ones you'd rather
            not.
          </li>
          <li>
            <strong>Weigh the calorie-dense things.</strong> If you only ever
            weigh three categories, make them oils and butter, nuts and nut
            butters, and cheese. That is where the big invisible errors are.
          </li>
          <li>
            <strong>Log the bits that don't feel like eating.</strong> The
            handful, the mouthful, the milk. That's the gap between a diary
            that explains your weight and one that doesn't.
          </li>
          <li>
            <strong>Don't re-litigate 20 calories.</strong> Two entries that
            differ by 4% are the same entry. Spend the attention on the
            portion size instead.
          </li>
          <li>
            <strong>Let your own data correct the bias.</strong> Four weeks of
            logging against your weight trend tells you what your numbers mean
            in practice, whatever they say on the label.
          </li>
        </ul>

        <div class="guide-note">
          <strong>One honest warning about precision.</strong>
          <p>
            For some people, chasing exactness stops being a tool and becomes
            the problem — weighing lettuce, refusing food that can't be
            measured, distress at an unloggable meal. If any of that sounds
            familiar, a food diary may not be the right thing for you right
            now, and that is worth discussing with a doctor or a registered
            dietitian rather than solving with a better app.
          </p>
        </div>

        <h2>Why we mark our own estimates</h2>

        <p>
          QuicKcals labels every entry as either verified or estimated, and
          shows the portion an estimate assumed. That isn't modesty. A number
          you can see the reasoning behind is one you can correct in a tap; a
          number presented as fact is one you either accept or abandon the app
          over. Given everything above, pretending to a precision the data
          can't support would be the actual dishonesty.
        </p>
'''

write_guide(
    slug="how-wrong-is-your-calorie-count",
    title="How wrong is your calorie count?",
    description="Labels carry a tolerance, portions get underestimated, and the handful while cooking never gets logged. Why your diary is wrong, by how much, and why it still works.",
    standfirst={"h1": "How wrong is your calorie count?",
                "lede": "Wrong enough to matter, and not in the way that stops it working. What the error actually is, and why consistency beats accuracy."},
    meta="Around 7 minutes &middot; Calories",
    body=body,
    nexts=[
        ("/guides/logging-food-you-didnt-cook", "Logging food you didn't cook",
         "Restaurants, takeaways and someone else's kitchen, without giving up."),
        ("/guides/what-you-actually-burn", "What you actually burn in a day",
         "Why the calculator's number is a population average, and how to find yours."),
    ],
)
print("guide 3 written")
