from shell import write_guide

body = '''
        <p>
          Every calorie calculator asks the same five things — height, weight,
          age, sex, how active you are — and hands back a confident number.
          Two people can give identical answers to all five and genuinely need
          a few hundred calories a day apart from each other.
        </p>
        <p>
          The number isn't wrong, exactly. It is an average of people like you,
          presented as a fact about you.
        </p>

        <h2>Where the number comes from</h2>

        <p>
          Almost every calculator runs one of a handful of equations — the
          Mifflin-St Jeor equation is the usual one — which were built by
          measuring a lot of people and fitting a line through the results.
          The line goes through the middle of the scatter. You are somewhere in
          the scatter, and nobody has told you where.
        </p>

        <p>
          The published error on these equations is routinely cited at around
          10% either way for resting metabolism alone. At a maintenance level
          near 2,400 kcal, that is a band several hundred calories wide before
          anyone has said the word "exercise".
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">±200-300</span>
          <p>
            Calories a day that two people with identical height, weight, age
            and sex can differ by. The calculator cannot see the difference,
            because the difference is not in what it asked you.
          </p>
        </div>

        <h2>The four things you're actually spending</h2>

        <p>
          A day's burn is four things, and they are not equally knowable.
        </p>

        <div class="guide-table-wrap">
          <table>
            <thead>
              <tr><th>Component</th><th>What it is</th><th>Share</th></tr>
            </thead>
            <tbody>
              <tr><td>Resting metabolism</td><td>Staying alive at rest — organs, brain, heat</td><td>~60-70%</td></tr>
              <tr><td>Digestion</td><td>The cost of processing what you ate</td><td>~10%</td></tr>
              <tr><td>Deliberate exercise</td><td>The run, the gym, the match</td><td>~5-10%</td></tr>
              <tr><td>Everything else you do</td><td>Walking, standing, fidgeting, gesturing</td><td>Wildly variable</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          That last row is the one that ruins the tidy arithmetic. It has a
          name — non-exercise activity thermogenesis, which nobody says out
          loud — and between two similar people it can differ by hundreds of
          calories a day. One of them takes the stairs, stands on the phone,
          walks while thinking and cannot sit still. The other doesn't. Neither
          would describe themselves differently on a form with four activity
          levels on it.
        </p>

        <p>
          It also isn't fixed. Eat less for long enough and it quietly falls:
          you move less, without deciding to. That is a real effect, and it is
          part of why the calculator's number stops being right partway through
          a diet even if it was right at the start.
        </p>

        <h2>The one measurement that is actually about you</h2>

        <p>
          You cannot measure your metabolism at home. You can do something
          better: measure its consequences.
        </p>

        <p>
          If you know roughly what you ate over several weeks, and you know
          what your weight did over those same weeks, then your real
          maintenance level falls out of the arithmetic. Weight held steady on
          2,300 a day means your maintenance is about 2,300 — whatever any
          equation says. Lost half a kilo a week on 2,000 means you were
          running about 550 a day under, so maintenance is nearer 2,550.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">4 weeks</span>
          <p>
            The shortest honest window. Under that, water movement is larger
            than the signal you are trying to read, and you will calculate your
            metabolism from a salty Tuesday.
          </p>
        </div>

        <p>
          This is the only method on this page that is about you specifically
          rather than about people resembling you. It needs nothing but a diary
          and a scale, and it gets better the longer it runs.
        </p>

        <h3>Doing it honestly</h3>

        <ul>
          <li>
            <strong>Use trend weight, not a single weigh-in at each end.</strong>
            Comparing one Monday to another Monday measures two days' water
            balance as much as four weeks of fat.
            <a href="/guides/why-the-scale-lies">Here's why that matters.</a>
          </li>
          <li>
            <strong>Log everything, including the bad days.</strong> A diary
            with the weekends missing produces a maintenance figure that is too
            low, and then a target built from it that you cannot hold.
          </li>
          <li>
            <strong>Expect it to move.</strong> As you get lighter you need
            less. A figure worked out in January is not a figure for June.
          </li>
          <li>
            <strong>Don't re-derive it every week.</strong> Four weeks of data,
            updated as more arrives. Chasing it weekly means chasing noise.
          </li>
        </ul>

        <h2>What a watch or a tracker adds</h2>

        <p>
          A wearable measures what a formula guesses — sort of. It has real
          data for heart rate and movement, which makes its estimate of
          <em>activity</em> genuinely better than a four-option dropdown. It is
          still estimating resting metabolism, and it still cannot see the
          fidgeting.
        </p>

        <p>
          Treat a tracker's daily burn as a good estimate rather than a
          measurement, and it earns its place. Treat it as gospel and you will
          eat back calories that were never spent — device estimates of calories
          burned during exercise are the least accurate figure they produce.
        </p>

        <h2>So what number should you use?</h2>

        <p>
          Start with the calculator, because you have to start somewhere. Then
          stop trusting it as soon as you have four weeks of your own data,
          because at that point you have something better: not an estimate of
          what someone your size burns, but a measurement of what you burned.
        </p>
'''

write_guide(
    slug="what-you-actually-burn",
    title="What you actually burn in a day",
    description="Calorie calculators give you an average of people like you, not a fact about you. Where the number comes from, why it can be hundreds out, and how to measure your own.",
    standfirst={"h1": "What you actually burn in a day",
                "lede": "The calculator gave you a confident number. It is an average of people resembling you — and there is a way to find yours instead."},
    meta="Around 7 minutes &middot; Calories",
    body=body,
    nexts=[
        ("/guides/how-wrong-is-your-calorie-count", "How wrong is your calorie count?",
         "Label tolerances, portion errors, and why consistency beats accuracy."),
        ("/guides/why-the-weight-stopped-moving", "Why the weight stopped moving",
         "Three causes of a plateau, and how to tell which one you have."),
    ],
)
print("guide 2 written")
