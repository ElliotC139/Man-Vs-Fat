from shell import write_guide

body = '''
        <p>
          Most food diaries work beautifully until you eat something you didn't
          make. Then you're staring at a plate someone else built, with no
          label, no weights, and a growing suspicion that you should just not
          log today.
        </p>
        <p>
          Not logging is the worst available option, and it is the one almost
          everybody picks. Here is how to do the other thing.
        </p>

        <h2>Start with the published figures, and know their limits</h2>

        <p>
          Big chains publish nutrition information, and it's genuinely useful —
          it comes from a standardised recipe and a real analysis. Use it when
          it exists.
        </p>

        <p>
          Two caveats worth holding onto. It describes the <em>standard build</em>:
          the burger as specified, with the sauce as specified, assembled by
          someone following the spec. Real kitchens are staffed by real people
          and portions drift. And it describes the item, not your order — no
          mayo, extra cheese, a different side, and you are already away from
          the published number.
        </p>

        <p>
          Independent restaurants publish nothing at all, and that's most places
          you'll eat.
        </p>

        <h2>Build the plate from parts you can name</h2>

        <p>
          The trick that makes this tractable: don't try to find "chicken
          katsu curry" as a single item. Break the plate into components you
          can estimate individually, because you have a much better instinct
          for a chicken breast and a cup of rice than for a composite dish.
        </p>

        <div class="guide-table-wrap">
          <table>
            <thead>
              <tr><th>Component</th><th>Useful anchor</th><th>kcal</th></tr>
            </thead>
            <tbody>
              <tr><td>Chicken breast, cooked</td><td>Palm-sized, ~150g</td><td>~250</td></tr>
              <tr><td>Cooked rice</td><td>A fist, ~200g</td><td>~260</td></tr>
              <tr><td>Chips, restaurant portion</td><td>A side order</td><td>~400-500</td></tr>
              <tr><td>Olive oil or butter</td><td>A tablespoon</td><td>~100-120</td></tr>
              <tr><td>Mayonnaise or aioli</td><td>A tablespoon</td><td>~90-100</td></tr>
              <tr><td>Pint of lager</td><td>Standard strength</td><td>~180-200</td></tr>
              <tr><td>Large glass of wine</td><td>250ml</td><td>~200-230</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          These are approximations and they are meant to be. The point is that
          five reasonable component estimates add up to something much closer
          than one anxious guess at the whole plate — errors in either direction
          partly cancel, where a single guess just is whatever it is.
        </p>

        <h2>Three places restaurant calories hide</h2>

        <h3>Fat you can't see</h3>

        <p>
          Restaurant food tastes better partly because it contains more butter
          and oil than you'd use at home. Vegetables arrive glossy. Sauces are
          finished with butter. This is the single biggest gap between a dish
          as you'd cook it and the same dish out, and it is invisible.
          A reasonable habit: if a dish arrives shining, add 100-150 kcal to
          whatever you first thought.
        </p>

        <h3>Portion size</h3>

        <p>
          A restaurant serving of pasta is commonly двое what you'd plate at
          home. The dish isn't different; there's just more of it. When in
          doubt, estimate the portion generously and the ingredients honestly.
        </p>

        <h3>Drinks</h3>

        <p>
          Three pints is most of a meal. Alcohol is seven calories a gram —
          between carbohydrate and fat — and it arrives with no sense of being
          food at all. Log the drinks before you agonise over whether the
          chicken was 140g or 170g, because the drinks are the bigger number.
        </p>

        <h2>Just get it approximately right, now</h2>

        <p>
          The instinct is to leave it until you can look it up properly, and
          then it's Thursday and the meal is gone. An estimate logged at the
          table beats a perfect entry you never make, for exactly the reason
          the rest of this applies: the diary's value is in being complete,
          not exact.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">Log it wrong</span>
          <p>
            A meal estimated 20% out still tells the truth about your week. A
            meal left out entirely makes the whole week's arithmetic lie, and
            takes your maintenance figure with it.
          </p>
        </div>

        <h2>The one habit that pays off</h2>

        <p>
          Estimate it, log it, and then <strong>save it</strong>. You go to the
          same handful of places. The Friday curry, the work lunch, the usual
          Sunday pub order — get each one roughly right once and it's a single
          tap forever after, with the same figure every time.
        </p>

        <p>
          That consistency matters more than the accuracy of the original
          estimate. If your saved "Nando's usual" is 80 calories light, it is
          80 calories light every time, and it cancels out of your maintenance
          arithmetic the same way every other systematic error does.
          <a href="/guides/how-wrong-is-your-calorie-count">Consistency beats accuracy</a>,
          and eating out is where that principle earns its keep.
        </p>

        <h2>What we do about this</h2>

        <p>
          QuicKcals lets you describe a meal in plain English — "half a chicken,
          chips and a pint" — and itemises it, showing the portion it assumed
          for each part so you can correct the one that's wrong rather than
          rejecting the lot. It's marked as an estimate, because it is one.
          Then you save it, and next Friday it's one tap.
        </p>
'''

write_guide(
    slug="logging-food-you-didnt-cook",
    title="Logging food you didn't cook",
    description="Restaurants, takeaways and someone else's kitchen. How to estimate a plate you didn't build, where restaurant calories hide, and why a rough entry beats no entry.",
    standfirst={"h1": "Logging food you didn't cook",
                "lede": "No label, no scales, someone else's portions. The practical way to log a meal out without giving up on the week."},
    meta="Around 6 minutes &middot; Eating out",
    body=body,
    nexts=[
        ("/guides/how-wrong-is-your-calorie-count", "How wrong is your calorie count?",
         "Label tolerances, portion errors, and why consistency beats accuracy."),
        ("/guides/why-the-weight-stopped-moving", "Why the weight stopped moving",
         "Three causes of a plateau, and how to tell which one you have."),
    ],
)
print("guide 4 written")
