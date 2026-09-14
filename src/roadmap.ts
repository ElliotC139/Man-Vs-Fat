/**
 * What we say we might build, and what a vote on it is allowed to name.
 *
 * This list exists in one place because it is read from three:
 *
 *   - the landing page, which shows it to strangers;
 *   - the vote endpoint, which refuses an id that isn't here, so the table
 *     can't be filled with whatever somebody posts;
 *   - the admin screen, which puts a count beside each one.
 *
 * ── The rule these have to satisfy ───────────────────────────────────────
 *
 * Every item below is something we know how to build and would actually
 * build. That is not a nicety. This app removed a live-Apple-Health claim
 * from its own landing page for being untrue, and a roadmap padded with
 * things nobody intends to ship is the same error wearing a friendlier hat —
 * except a roadmap gets read by the people deciding whether to trust a new
 * app with their diary.
 *
 * So: no dates, ever. A date is the one thing here that can become a broken
 * promise on its own, without anybody changing their mind. "Exploring" is a
 * weaker and more honest claim than "coming soon", and it is the default.
 *
 * ── Why the votes are not shown publicly ─────────────────────────────────
 *
 * A tally is social proof once it is large and an argument against yourself
 * while it is small: "3 people want this" reads as nobody wanting it. The
 * counts go to the admin screen, where they are a decision input. The visitor
 * gets a thank-you, which is all a vote is worth to them anyway.
 */

/** Where an item sits on the page. Ordering within a group is this file's. */
export type RoadmapGroup = "connect" | "feature";

/**
 * How far along something is.
 *
 * "next" is a commitment and should be rare — at most a couple at a time, and
 * only for work genuinely queued. Everything else is "exploring", which
 * promises nothing beyond having thought about it.
 */
export type RoadmapStatus = "next" | "exploring";

export interface RoadmapItem {
  id: string;
  group: RoadmapGroup;
  status: RoadmapStatus;
  /** What a person would call it. Device names are spelled the owner's way. */
  title: string;
  /** One sentence, in the visitor's terms, saying what they would get. */
  blurb: string;
}

export const ROADMAP: readonly RoadmapItem[] = [
  // ── Things to connect ───────────────────────────────────────────────────
  //
  // Every one of these is real. The first five arrive together through a
  // phone app, because they all already write into Apple Health or Health
  // Connect; Fitbit, Garmin and Withings also have web APIs of their own, the
  // way WHOOP does today. None of it is speculative — it is a question of
  // which order, which is exactly what a vote is for.
  {
    id: "apple-watch",
    group: "connect",
    status: "exploring",
    title: "Apple Watch",
    blurb: "Your rings and active calories, read straight into the day's burn.",
  },
  {
    id: "fitbit",
    group: "connect",
    status: "exploring",
    title: "Fitbit",
    blurb: "Burn, steps and sleep, connected the same way WHOOP already is.",
  },
  {
    id: "garmin",
    group: "connect",
    status: "exploring",
    title: "Garmin",
    blurb: "Every run and ride, with the calories Garmin actually measured.",
  },
  {
    id: "oura",
    group: "connect",
    status: "exploring",
    title: "Oura Ring",
    blurb: "Sleep and readiness beside what you ate the day before.",
  },
  {
    id: "wear-os",
    group: "connect",
    status: "exploring",
    title: "Pixel Watch, Galaxy Watch and Wear OS",
    blurb: "Android's side of the same deal — burn and steps, no typing.",
  },
  {
    id: "smart-scales",
    group: "connect",
    status: "exploring",
    title: "Withings and smart scales",
    blurb: "Stand on the scale and the weigh-in is already logged.",
  },

  // ── Things to build ─────────────────────────────────────────────────────
  {
    id: "alcohol",
    group: "feature",
    status: "exploring",
    title: "Drinks and nights out",
    blurb: "Units alongside calories, and a Saturday that doesn't wreck the week's read.",
  },
  {
    id: "coach-access",
    group: "feature",
    status: "exploring",
    title: "Share with a coach",
    blurb: "Read-only access for a PT or dietitian, without handing over your password.",
  },
  {
    id: "household",
    group: "feature",
    status: "exploring",
    title: "One plan, two people",
    blurb: "A household subscription, so a partner isn't paying twice.",
  },
  {
    id: "plan-ahead",
    group: "feature",
    status: "exploring",
    title: "Plan tomorrow, not just today",
    blurb: "Build the day before you eat it, and see what still fits.",
  },
  {
    id: "wrist-logging",
    group: "feature",
    status: "exploring",
    title: "Log from your wrist",
    blurb: "Add a coffee from the watch, without getting your phone out.",
  },
] as const;

const BY_ID = new Map(ROADMAP.map((item) => [item.id, item]));

/** Whether a posted id names something real. The vote endpoint's whole guard. */
export function isRoadmapId(value: unknown): value is string {
  return typeof value === "string" && BY_ID.has(value);
}

export function roadmapItem(id: string): RoadmapItem | undefined {
  return BY_ID.get(id);
}

export function roadmapGroup(group: RoadmapGroup): RoadmapItem[] {
  return ROADMAP.filter((item) => item.group === group);
}
