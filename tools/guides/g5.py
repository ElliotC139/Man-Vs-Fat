from shell import write_guide

body = '''
        <p>
          Four weeks ago the weight was coming off. Nothing has changed — same
          food, same routine, same effort — and the number has sat still for a
          fortnight.
        </p>
        <p>
          There are three real explanations. They need completely different
          responses, and most people reach for the wrong one, because the wrong
          one is the most dramatic.
        </p>

        <h2>First: is it actually a plateau?</h2>

        <p>
          Before diagnosing anything, check you're reading a trend and not a
          fortnight of noise. Daily weight swings a kilo or more on water alone,
          which is more than two good weeks of fat loss — so a flat-looking
          fortnight on single weigh-ins is completely consistent with steady
          progress underneath.
          <a href="/guides/why-the-scale-lies">The arithmetic is here.</a>
        </p>

        <p>
          Four weeks of a flat <em>trend</em> is a plateau. Two weeks of flat
          daily readings is a Tuesday.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">4 weeks</span>
          <p>
            Of flat trend weight before you change anything. Act on less and
            you'll be responding to water while your actual diet was working.
          </p>
        </div>

        <h2>Cause one: the logging drifted</h2>

        <p>
          This is the most common by a wide margin, and the least welcome,
          so it is worth saying plainly: it is not a character failing. It is
          what happens to every diary over time.
        </p>

        <p>
          The portions creep up a little. The peanut butter goes on more
          generously than the day you weighed it. A few things stop getting
          logged because you already know roughly what they are. Weekends get
          thinner. None of it is a decision, and a few hundred calories a day
          of drift is enough to close a deficit entirely.
        </p>

        <p><strong>How to tell:</strong> weigh and log everything meticulously
        for five days, including the weekend, exactly as you did in week one.
        If the intake comes out meaningfully above what you thought you were
        eating, that's your answer — and the fix is just to return to the
        standard you'd already set, not to cut further.</p>

        <h2>Cause two: water is hiding it</h2>

        <p>
          Fat can leave while water arrives, and the scale shows you the sum.
          This can run for weeks and then resolve overnight, which is where the
          "whoosh" people describe comes from — nothing happened that morning
          except the water finally leaving.
        </p>

        <p>Common triggers:</p>

        <ul>
          <li><strong>New or harder training.</strong> Muscle holds water while it repairs.</li>
          <li><strong>Stress and poor sleep.</strong> Both raise cortisol, which encourages fluid retention.</li>
          <li><strong>A saltier stretch.</strong> Holiday, takeaways, eating out more than usual.</li>
          <li><strong>The menstrual cycle.</strong> Fluid shifts across a month can exceed a kilo, so compare like with like — this month's week three against last month's week three.</li>
        </ul>

        <p><strong>How to tell:</strong> the other measures disagree with the
        scale. Clothes fitting better, measurements down, progress photos
        changing, strength holding — while the weight sits still. That
        combination is fat loss being masked, and the correct response is to
        change nothing and wait.</p>

        <h2>Cause three: you genuinely need less food now</h2>

        <p>
          A smaller body costs less to run. Lose 10kg and your maintenance has
          genuinely fallen — partly because there's less of you, partly because
          the unconscious movement drops when you've been eating less for a
          while.
        </p>

        <p>
          So the deficit you started with has been shrinking the whole time.
          Eventually your old "deficit" is simply your new maintenance, and the
          weight stops. Nothing has gone wrong; the arithmetic moved.
        </p>

        <p><strong>How to tell:</strong> your logging is honest, the other
        measures agree the weight really is static, and you've lost a
        meaningful amount since you set your target. Then it's time to
        recalculate maintenance from your recent data rather than from the
        figure you started with.
        <a href="/guides/what-you-actually-burn">How to do that is here.</a></p>

        <h2>What it almost certainly isn't</h2>

        <p>
          <strong>"Starvation mode", as usually described.</strong> The idea
          that eating too little makes your body cling to fat and stop losing
          weight is not what happens. Metabolism does fall somewhat when you
          eat less — that's cause three, and it's real but modest. It does not
          go far enough to halt fat loss in someone genuinely in a deficit.
          If the weight is truly static over four weeks of trend, you are not
          in a deficit, however small the number in the diary looks.
        </p>

        <p>
          <strong>One specific food or macro.</strong> Bread did not do this.
          Eating after 8pm did not do this. The arithmetic is about the total.
        </p>

        <h2>What to do, in order</h2>

        <ol>
          <li><strong>Wait four weeks</strong> and read the trend, not the daily numbers.</li>
          <li><strong>Audit the logging</strong> for five honest days before changing anything you eat.</li>
          <li><strong>Check the other measures</strong> — tape, photos, how clothes fit, strength.</li>
          <li><strong>Only then recalculate</strong> maintenance from your own recent intake and trend.</li>
          <li><strong>Adjust modestly.</strong> 100-200 kcal, or a bit more walking. Big cuts make adherence worse, which causes the drift in step two.</li>
        </ol>

        <p>
          Notice that three of the five steps are measuring rather than
          changing. That ordering is the actual advice. Most stalled diets get
          cut harder when they needed reading more carefully, and a harder cut
          makes the logging drift worse — which is what caused the stall.
        </p>

        <div class="guide-note">
          <strong>When to get help rather than cut further.</strong>
          <p>
            If you're already eating little, have been dieting a long time, or
            the weight won't move despite genuinely careful logging, that's a
            conversation with a doctor or registered dietitian rather than
            another 200 calories off. The same goes if any of this has started
            to feel compulsive.
          </p>
        </div>
'''

write_guide(
    slug="why-the-weight-stopped-moving",
    title="Why the weight stopped moving",
    description="Three real causes of a plateau — logging drift, water masking fat loss, and a genuinely lower maintenance — how to tell which you have, and what to do about each.",
    standfirst={"h1": "Why the weight stopped moving",
                "lede": "Same food, same effort, flat scale. Three explanations, each needing a different response — and one of them is to do nothing."},
    meta="Around 7 minutes &middot; Weight",
    body=body,
    nexts=[
        ("/guides/why-the-scale-lies", "Why the scale lies",
         "What a kilo overnight actually was, and the number to read instead."),
        ("/guides/what-you-actually-burn", "What you actually burn in a day",
         "How to work out your real maintenance from your own data."),
    ],
)
print("guide 5 written")
