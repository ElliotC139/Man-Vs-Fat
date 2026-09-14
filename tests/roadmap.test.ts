import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROADMAP, isRoadmapId, roadmapGroup, roadmapItem } from "../src/roadmap";

/**
 * A roadmap is a set of claims about what a product will do, made to people
 * deciding whether to trust it. This app has already had to remove one untrue
 * claim from the same page, so the bar here is the same as everywhere else:
 * what the page says and what the code knows have to be the same thing, and a
 * test has to be what keeps them that way rather than somebody remembering.
 */

const landing = readFileSync(path.join(process.cwd(), "public", "landing.html"), "utf8");

function cardIds(): string[] {
  return [...landing.matchAll(/data-roadmap-id="([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("the list itself", () => {
  it("has no duplicate ids", () => {
    const ids = ROADMAP.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses ids that are safe in a URL and a data attribute", () => {
    for (const item of ROADMAP) {
      expect(item.id, `${item.id} is not a plain slug`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("gives every item something to read", () => {
    for (const item of ROADMAP) {
      expect(item.title.length).toBeGreaterThan(2);
      // A blurb that says nothing is worse than no blurb — it takes the space
      // a reason would have gone in.
      expect(item.blurb.length, `${item.id} has a thin blurb`).toBeGreaterThan(25);
    }
  });

  it("promises little: nothing is marked as committed by accident", () => {
    // "next" is a commitment. It should be rare and deliberate, so this fails
    // loudly if a batch of items quietly gets promoted.
    const committed = ROADMAP.filter((item) => item.status === "next");
    expect(committed.length).toBeLessThanOrEqual(2);
  });

  it("names no dates anywhere", () => {
    // The one thing on a roadmap that can become a broken promise without
    // anybody changing their mind.
    const text = ROADMAP.map((i) => `${i.title} ${i.blurb}`).join(" ");
    expect(text).not.toMatch(/\b(20\d\d|Q[1-4]\b|January|February|March|April|May|June|July|August|September|October|November|December)\b/);
    expect(text.toLowerCase()).not.toMatch(/\b(soon|shortly|next month|next week|by the end of)\b/);
  });
});

describe("what a vote is allowed to name", () => {
  it("accepts every id on the list", () => {
    for (const item of ROADMAP) expect(isRoadmapId(item.id)).toBe(true);
  });

  it("refuses anything else", () => {
    // This is the only guard between an open endpoint and the table.
    for (const bad of ["", "apple", "apple-watch ", "APPLE-WATCH", "../../etc", null, 7, {}]) {
      expect(isRoadmapId(bad)).toBe(false);
    }
  });

  it("looks an item up by id", () => {
    expect(roadmapItem("apple-watch")?.group).toBe("connect");
    expect(roadmapItem("nope")).toBeUndefined();
  });

  it("splits into the two groups the page renders", () => {
    expect(roadmapGroup("connect").length).toBeGreaterThan(0);
    expect(roadmapGroup("feature").length).toBeGreaterThan(0);
    expect(roadmapGroup("connect").length + roadmapGroup("feature").length).toBe(ROADMAP.length);
  });
});

describe("the landing page agrees with the code", () => {
  it("renders a card for every item, in the same order", () => {
    // Order matters because the page groups by connect then feature, and a
    // mismatch would silently reorder or drop one.
    const expected = [
      ...roadmapGroup("connect").map((i) => i.id),
      ...roadmapGroup("feature").map((i) => i.id),
    ];
    expect(cardIds()).toEqual(expected);
  });

  it("shows no card the vote endpoint would refuse", () => {
    // The failure this catches is a button that looks live and silently 400s.
    for (const id of cardIds()) expect(isRoadmapId(id)).toBe(true);
  });

  it("prints each item's own words, not a paraphrase", () => {
    for (const item of ROADMAP) {
      expect(landing, `${item.id}'s title is missing`).toContain(item.title);
      expect(landing, `${item.id}'s blurb is missing`).toContain(item.blurb);
    }
  });

  it("reads as a roadmap with JavaScript switched off", () => {
    // Progressive enhancement is load-bearing here: this section is rendered
    // into the HTML rather than fetched, so a crawler and a reader with no
    // scripts both still see what is being built.
    expect(landing).toContain('id="whats-next"');
    expect(cardIds().length).toBe(ROADMAP.length);
  });

  it("puts no vote count on the page", () => {
    // A tally is social proof once it is large and an argument against
    // yourself while it is small. The counts belong on the admin screen.
    const section = landing.split('id="whats-next"')[1]?.split("</section>")[0] ?? "";
    expect(section).not.toMatch(/\d+\s*(people|votes?|wanted)/i);
  });

  it("says plainly that no date is being promised", () => {
    const section = landing.split('id="whats-next"')[1]?.split("</section>")[0] ?? "";
    expect(section.toLowerCase()).toContain("no dates");
  });
});

describe("the privacy policy covers what this collects", () => {
  const privacy = readFileSync(path.join(process.cwd(), "public", "privacy.html"), "utf8");

  it("explains the votes and the address", () => {
    // Collecting an email address without saying so in the policy is the kind
    // of quiet wrong this codebase keeps deciding not to do.
    expect(privacy.toLowerCase()).toContain("voting on what gets built");
    expect(privacy).toMatch(/email address/i);
  });

  it("is honest that a browser id is stored locally", () => {
    expect(privacy.toLowerCase()).toMatch(/random id/);
  });
});

describe("the board inside the app", () => {
  const shell = readFileSync(path.join(process.cwd(), "public", "index.html"), "utf8");

  it("has somewhere to render into", () => {
    expect(shell).toContain('id="roadmap-board"');
  });

  it("keeps no second copy of the list to fall out of step", () => {
    // The landing page has to write the items into its HTML because a crawler
    // reads it. This shell is noindex and script-driven, so it fetches them —
    // and the failure this guards against is somebody "helpfully" pasting the
    // list in here, where nothing would ever check it again.
    for (const item of ROADMAP) {
      expect(shell, `${item.id}'s blurb is hardcoded in the app shell`).not.toContain(item.blurb);
    }
  });

  it("is reachable without being an admin", () => {
    // It sits in Settings, which every account has, rather than behind the
    // admin tab where only one person would ever see it.
    const section = shell.split('id="roadmap-board"')[0] ?? "";
    expect(section).toContain("What we build next");
    expect(section).not.toMatch(/admin-screen[\s\S]{0,400}roadmap-board/);
  });
});
