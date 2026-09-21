from shell import write_guide

body = '''
        <p>
          You did everything right on Monday. You weighed on Tuesday and you
          were a kilo heavier. Nothing you ate on Monday could have done that,
          and yet there it is on the display, and it is very hard not to read
          it as a verdict.
        </p>
        <p>
          It isn't one. Here is the arithmetic that settles it.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">7,700&nbsp;kcal</span>
          <p>
            Roughly what a kilogram of body fat is worth. To gain one in a day
            you would have to eat about four days' food on top of everything
            you already ate. A big Sunday lunch is not that.
          </p>
        </div>

        <p>
          That figure is a rule of thumb rather than a constant — real tissue
          is not pure fat, and the number moves depending on who is doing the
          measuring — but it is the right order of magnitude, and the order of
          magnitude is the whole point. Whatever the scale showed you this
          morning, almost none of the overnight change was fat.
        </p>

        <h2>What the extra kilo actually was</h2>

        <p>
          Bodyweight is mostly water, and water moves around for reasons that
          have nothing to do with fat.
        </p>

        <ul>
          <li>
            <strong>Glycogen.</strong> Your muscles and liver store carbohydrate
            as glycogen, and each gram of it is held with roughly three grams of
            water. Eat a carb-heavy meal after a low-carb stretch and you refill
            those stores — which is a real gain in mass, and none of it is fat.
            Go the other way and you "lose" a couple of kilos in three days,
            which is why low-carb diets feel miraculous in week one.
          </li>
          <li>
            <strong>Salt.</strong> A saltier day than usual means more water
            retained until your kidneys catch up. A takeaway can do this on its
            own.
          </li>
          <li>
            <strong>Food still in transit.</strong> What you ate yesterday has
            mass and has not finished its journey. A high-fibre day leaves more
            of it in you for longer.
          </li>
          <li>
            <strong>New or harder training.</strong> Muscle you have just worked
            holds extra water while it repairs. Starting to exercise can put the
            scale up for a fortnight while you are actively losing fat.
          </li>
          <li>
            <strong>Hormones.</strong> For anyone who menstruates, fluid shifts
            across the cycle can comfortably exceed a kilo and follow a monthly
            pattern that has nothing to do with the diet.
          </li>
          <li>
            <strong>Sleep and stress.</strong> Both move fluid balance. A bad
            night can cost you a morning's apparent progress.
          </li>
        </ul>

        <p>
          Any two of those can stack to a kilo or more. All of them can reverse
          within days. None of them is the thing you are trying to measure.
        </p>

        <h2>The signal is smaller than the noise</h2>

        <p>
          This is the part people find genuinely surprising. A sensible rate of
          fat loss is somewhere around 0.5% of bodyweight a week — about 400g
          for someone at 80kg. That is what a good week looks like.
        </p>

        <p>
          Daily water swings are routinely two or three times that. So on any
          given morning the number in front of you is mostly noise, with a week
          of real progress hidden somewhere inside it. Reading a single weigh-in
          is reading the noise.
        </p>

        <div class="guide-figure">
          <span class="guide-figure-number">400g vs 1.5kg</span>
          <p>
            A good week's fat loss, against the range a single day's water
            weight can move. The thing you want to see is smaller than the
            thing in the way of seeing it.
          </p>
        </div>

        <h2>Weigh more often, not less</h2>

        <p>
          The intuitive response is to weigh less — once a week, to avoid the
          noise. It is the wrong move, and it is wrong for a reason worth
          understanding.
        </p>

        <p>
          Weighing weekly does not remove the noise. It gives you one sample
          that contains all of it. If your Wednesday happened to follow a
          takeaway, that is your whole week's data point, and next Wednesday
          will be compared against a number that was never true.
        </p>

        <p>
          Weighing daily and averaging does remove it. Seven readings around a
          true value average out much closer to that value than any one of them
          sits. The noise is random; the fat loss is not. Given enough samples
          the random part cancels and the trend is what's left.
        </p>

        <p>
          That average is what people mean by <strong>trend weight</strong>. It
          is the line through the scatter, and it is the only weight figure
          worth making decisions on.
        </p>

        <h3>What that looks like in practice</h3>

        <ul>
          <li>Weigh every morning, after the loo, before anything else, no clothes on.</li>
          <li>Record it and then stop thinking about it. The daily number is a data point, not a result.</li>
          <li>Read the trend line, not today's reading.</li>
          <li>Judge progress over three to four weeks, not three to four days.</li>
        </ul>

        <p>
          The consistency matters more than the time of day. Same conditions
          every morning means the errors are at least the same shape, and a
          consistent error cancels out of a trend where a random one does not.
        </p>

        <div class="guide-note">
          <strong>If daily weighing makes you miserable, don't.</strong>
          <p>
            For some people stepping on a scale every morning turns into
            something it shouldn't, and no amount of statistical tidiness is
            worth that. The trend works on whatever data it gets — if weighing
            twice a week is what you can do sustainably, do that and read it
            over a longer window. And if the scale is a bad relationship
            full stop, measurements and how clothes fit will tell you the same
            story more slowly.
          </p>
        </div>

        <h2>Reading a trend that has stalled</h2>

        <p>
          Once you are reading a trend rather than a day, a flat fortnight
          actually means something — and it still might not mean what you think.
          Four weeks is the honest window for deciding the trend has changed,
          because water can mask real fat loss for a surprisingly long time.
          The classic version is starting a new training programme: the fat is
          going, the water arriving to repair the muscle roughly cancels it out
          on the display, and then a few weeks later the whole lot shows up at
          once. Nothing happened that week. It had been happening all along.
        </p>
'''

write_guide(
    slug="why-the-scale-lies",
    title="Why the scale lies — and what to read instead",
    description="A kilo overnight isn't fat: it's water, glycogen and yesterday's dinner. Why daily weigh-ins mislead, why weighing more often beats weighing less, and how to read a trend.",
    standfirst={"h1": "Why the scale lies, and what to read instead",
                "lede": "You cannot gain a kilo of fat overnight. Here is what you actually gained, and the number to read instead of the one on the display."},
    meta="Around 6 minutes &middot; Weight",
    body=body,
    nexts=[
        ("/guides/what-you-actually-burn", "What you actually burn in a day",
         "Why the calculator's number is a population average, and how to find yours."),
        ("/guides/why-the-weight-stopped-moving", "Why the weight stopped moving",
         "Three causes of a plateau, and how to tell which one you have."),
    ],
)
print("guide 1 written")
