/**
 * "What can I still eat?"
 *
 * Answers one question the diary otherwise leaves the user to work out in
 * their head: given what's already been eaten today, what actually fits in
 * the calories and macros that are left?
 *
 * Two deliberate constraints on the answer:
 *
 * 1. **Suggestions come from the user's own food library and saved meals**,
 *    never from a model. "Grilled salmon" is a useless suggestion to someone
 *    who has never had salmon in the house, and a generated one costs an AI
 *    call every time the Today screen loads. Everything offered here is
 *    something they have logged before, at the figures they logged it at.
 *
 * 2. **It reports, it doesn't advise.** Same stance as the estimator prompt
 *    and the insights card: these are the things that fit, and what they'd
 *    leave. Nothing here tells anyone what they ought to eat.
 */

import {
  MACRO_KEYS,
  type MacroKey,
  type MacroOp,
  type ResolvedMacroTargets,
} from "./macros";

/**
 * Matches the margin macroProgress() allows an "about" target — an eq target
 * is read here as a floor and a ceiling the same distance either side of the
 * figure, so what counts as "fits" agrees with what the Today card calls met.
 */
const EQ_TOLERANCE = 0.05;

/** How many suggestions the card gets, and how many of those may be pairs. */
const MAX_SUGGESTIONS = 6;
const MAX_PAIRS = 2;

/**
 * With a ceiling already passed the card isn't answering "what fits" any more
 * — nothing does — it's answering "what adds least to the one I've gone past".
 * A short list of the leanest options says that; a full six reads like a menu.
 */
const MAX_SUGGESTIONS_OVER_CEILING = 3;

/**
 * Pairs are drawn only from this many of the most-logged foods. Every
 * combination of the whole library would be quadratic on a list that grows
 * for the life of the account; the top slice keeps the work bounded and is
 * also where the plausible combinations are.
 */
const PAIR_POOL = 20;

/** A food from the library, after any correction has been applied. */
export interface WhatNowFood {
  labelKey: string;
  label: string;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Times logged — stands in for how familiar it is. */
  count: number;
}

/** A saved meal or recipe, costed per serving. */
export interface WhatNowMeal {
  id: number;
  name: string;
  kind: string;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** One tracked macro, expressed as room rather than as progress. */
export interface MacroRoom {
  key: MacroKey;
  op: MacroOp;
  target: number;
  eaten: number;
  /**
   * Grams that can still be added without breaching a ceiling — null for a
   * floor, which has no upper edge, and negative when a ceiling has already
   * been passed.
   */
  headroom: number | null;
  /** Grams still needed to clear a floor. Zero once it's clear. */
  gap: number;
}

export interface SuggestionPart {
  kind: "food" | "meal";
  /** Set for a food — what POST /api/foods/log wants. */
  labelKey?: string;
  /** Set for a meal — what POST /api/meals/:id/log wants. */
  mealId?: number;
  label: string;
  kcal: number;
}

export interface Suggestion {
  id: string;
  kind: "food" | "meal" | "pair";
  label: string;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** What logging it would actually create — one call per part. */
  parts: SuggestionPart[];
  /** A plain statement of what it does to the day. Never a recommendation. */
  why: string;
}

export type WhatNowReason =
  | "ok"
  | "no-reference"
  | "no-room"
  | "empty-library"
  /** Macros are tracked and nothing in the library has figures for them. */
  | "macros-unknown"
  | "nothing-fits";

export interface WhatNowResult {
  available: boolean;
  reason: WhatNowReason;
  remainingKcal: number | null;
  macroRoom: MacroRoom[];
  /**
   * Ceilings already passed. When this isn't empty nothing can be suggested
   * that keeps the day inside them, so they stop being a filter and become
   * the first sort key instead — the list becomes "least of that macro" —
   * and the card says so rather than silently changing what it means.
   */
  breachedCeilings: MacroKey[];
  suggestions: Suggestion[];
  /**
   * Library entries left out because macros are being tracked and these have
   * no figures for them. Counting a missing macro as zero would let a 600 kcal
   * food look safe against a carb ceiling, so they're excluded and counted —
   * which is also the honest prompt to go and fill them in.
   */
  skippedForMissingMacros: number;
}

interface Candidate {
  id: string;
  kind: "food" | "meal" | "pair";
  label: string;
  kcal: number;
  grams: Record<MacroKey, number | null>;
  parts: SuggestionPart[];
  familiarity: number;
}

function gramsOf(source: { proteinG: number | null; carbsG: number | null; fatG: number | null }): Record<MacroKey, number | null> {
  return { protein: source.proteinG, carbs: source.carbsG, fat: source.fatG };
}

/** Turns resolved targets and the day's totals into room rather than progress. */
export function macroRoom(
  targets: ResolvedMacroTargets | null,
  eaten: Record<MacroKey, number>,
): MacroRoom[] {
  if (!targets) return [];
  const rooms: MacroRoom[] = [];

  for (const key of MACRO_KEYS) {
    const target = targets.targets[key];
    if (!target) continue;
    const had = eaten[key];

    if (target.op === "min") {
      rooms.push({ key, op: "min", target: target.grams, eaten: had, headroom: null, gap: round1(Math.max(0, target.grams - had)) });
    } else if (target.op === "max") {
      rooms.push({ key, op: "max", target: target.grams, eaten: had, headroom: round1(target.grams - had), gap: 0 });
    } else {
      // An "about" figure is both at once, inside the same margin the Today
      // card uses to call it met.
      const margin = target.grams * EQ_TOLERANCE;
      rooms.push({
        key,
        op: "eq",
        target: target.grams,
        eaten: had,
        headroom: round1(target.grams + margin - had),
        gap: round1(Math.max(0, target.grams - margin - had)),
      });
    }
  }

  return rooms;
}

export interface WhatNowInput {
  /** Calories left today: the reference figure minus what's been eaten. */
  remainingKcal: number | null;
  rooms: MacroRoom[];
  foods: WhatNowFood[];
  meals: WhatNowMeal[];
}

export function whatCanIStillEat(input: WhatNowInput): WhatNowResult {
  const { remainingKcal, rooms, foods, meals } = input;

  const base = {
    remainingKcal,
    macroRoom: rooms,
    breachedCeilings: [] as MacroKey[],
    suggestions: [] as Suggestion[],
    skippedForMissingMacros: 0,
  };

  if (remainingKcal === null) return { ...base, available: false, reason: "no-reference" };
  if (remainingKcal <= 0) return { ...base, available: false, reason: "no-room" };
  if (foods.length === 0 && meals.length === 0) return { ...base, available: false, reason: "empty-library" };

  const trackedKeys = rooms.map((r) => r.key);
  const breachedCeilings = rooms.filter((r) => r.headroom !== null && r.headroom < 0).map((r) => r.key);

  // ── Candidates ───────────────────────────────────────────────────────────
  let skipped = 0;
  const singles: Candidate[] = [];
  const maxCount = Math.max(1, ...foods.map((f) => f.count));

  for (const food of foods) {
    if (food.kcal <= 0) continue;
    const grams = gramsOf(food);
    if (trackedKeys.some((key) => grams[key] === null)) {
      skipped += 1;
      continue;
    }
    singles.push({
      id: `food:${food.labelKey}`,
      kind: "food",
      label: food.label,
      kcal: food.kcal,
      grams,
      parts: [{ kind: "food", labelKey: food.labelKey, label: food.label, kcal: food.kcal }],
      familiarity: food.count / maxCount,
    });
  }

  for (const meal of meals) {
    if (meal.kcal <= 0) continue;
    const grams = gramsOf(meal);
    if (trackedKeys.some((key) => grams[key] === null)) {
      skipped += 1;
      continue;
    }
    singles.push({
      id: `meal:${meal.id}`,
      kind: "meal",
      label: meal.name,
      kcal: meal.kcal,
      grams,
      parts: [{ kind: "meal", mealId: meal.id, label: meal.name, kcal: meal.kcal }],
      // A saved meal was deliberately created by the user, which is a
      // stronger statement of "I eat this" than any log count.
      familiarity: 1,
    });
  }

  // Macros are being tracked and not one food has figures for them: there is
  // nothing to measure, which is a different thing from nothing fitting.
  if (singles.length === 0 && skipped > 0) {
    return { ...base, breachedCeilings, skippedForMissingMacros: skipped, available: false, reason: "macros-unknown" };
  }

  // Pairs, for the "two eggs on toast and a yoghurt" case a single food can't
  // cover. Only foods pair — a saved meal is already a combination.
  const pool = singles
    .filter((c) => c.kind === "food")
    .sort((a, b) => b.familiarity - a.familiarity)
    .slice(0, PAIR_POOL);

  const pairs: Candidate[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i]!;
      const b = pool[j]!;
      const kcal = a.kcal + b.kcal;
      if (kcal > remainingKcal) continue;
      pairs.push({
        id: `pair:${a.id}|${b.id}`,
        kind: "pair",
        label: `${a.label} + ${b.label}`,
        kcal,
        grams: {
          protein: addGrams(a.grams.protein, b.grams.protein),
          carbs: addGrams(a.grams.carbs, b.grams.carbs),
          fat: addGrams(a.grams.fat, b.grams.fat),
        },
        parts: [...a.parts, ...b.parts],
        familiarity: Math.min(a.familiarity, b.familiarity),
      });
    }
  }

  // ── Filter to what actually fits ─────────────────────────────────────────
  const fits = [...singles, ...pairs].filter((candidate) => {
    if (candidate.kcal > remainingKcal) return false;
    return rooms.every((room) => {
      // A ceiling that's already been passed can't be respected by anything,
      // so it stops filtering and starts sorting instead (below).
      if (room.headroom === null || room.headroom < 0) return true;
      return (candidate.grams[room.key] ?? 0) <= room.headroom;
    });
  });

  if (fits.length === 0) {
    return { ...base, breachedCeilings, skippedForMissingMacros: skipped, available: false, reason: "nothing-fits" };
  }

  // ── Rank ─────────────────────────────────────────────────────────────────
  //
  // Three things matter, in this order: does it help close a target that's
  // still short, does it make reasonable use of the calories that are left,
  // and is it something they actually eat. The weights are a stated
  // preference, not a measurement — closing an outstanding gap is what the
  // question is usually being asked for.
  const scored = fits
    .map((candidate) => ({ candidate, score: score(candidate, rooms, remainingKcal) }))
    .sort((a, b) => {
      // With a ceiling already passed, the least of that macro comes first —
      // everything below it is a tiebreak.
      if (breachedCeilings.length > 0) {
        const lean = (c: Candidate) => breachedCeilings.reduce((sum, key) => sum + (c.grams[key] ?? 0), 0);
        const diff = lean(a.candidate) - lean(b.candidate);
        if (Math.abs(diff) > 0.5) return diff;
      }
      return b.score - a.score;
    });

  // Two rules keep the card a set of real alternatives rather than a ranked
  // list of near-duplicates: no food appears twice on it, and pairs are held
  // to a small quota so it can't fill up with permutations of the same three
  // things. Both cost some raw score, and both are worth it — six variations
  // on chips is a worse answer than six different ones.
  const chosen: Candidate[] = [];
  const usedParts = new Set<string>();
  let pairCount = 0;

  const limit = breachedCeilings.length > 0 ? MAX_SUGGESTIONS_OVER_CEILING : MAX_SUGGESTIONS;

  for (const { candidate } of scored) {
    if (chosen.length >= limit) break;
    if (candidate.kind === "pair" && pairCount >= MAX_PAIRS) continue;
    if (candidate.parts.some((part) => usedParts.has(partKey(part)))) continue;
    if (candidate.kind === "pair") pairCount += 1;
    chosen.push(candidate);
    for (const part of candidate.parts) usedParts.add(partKey(part));
  }

  return {
    ...base,
    breachedCeilings,
    skippedForMissingMacros: skipped,
    available: true,
    reason: "ok",
    suggestions: chosen.map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      label: candidate.label,
      kcal: candidate.kcal,
      proteinG: candidate.grams.protein,
      carbsG: candidate.grams.carbs,
      fatG: candidate.grams.fat,
      parts: candidate.parts,
      why: explain(candidate, rooms, remainingKcal),
    })),
  };
}

function partKey(part: SuggestionPart): string {
  return part.kind === "meal" ? `meal:${part.mealId}` : `food:${part.labelKey}`;
}

function addGrams(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return round1(a + b);
}

const GAP_WEIGHT = 0.6;
const FILL_WEIGHT = 0.25;
const FAMILIARITY_WEIGHT = 0.15;

function score(candidate: Candidate, rooms: MacroRoom[], remainingKcal: number): number {
  const outstanding = rooms.filter((room) => room.gap > 0);
  const gapScore = outstanding.length === 0
    ? 0
    : outstanding.reduce((sum, room) => sum + Math.min(candidate.grams[room.key] ?? 0, room.gap) / room.gap, 0) /
      outstanding.length;

  const fill = Math.min(1, candidate.kcal / remainingKcal);

  return GAP_WEIGHT * gapScore + FILL_WEIGHT * fill + FAMILIARITY_WEIGHT * candidate.familiarity;
}

/**
 * One sentence of what this would do to the day, in the app's usual voice:
 * a statement of the arithmetic, never a suggestion that it's a good idea.
 */
function explain(candidate: Candidate, rooms: MacroRoom[], remainingKcal: number): string {
  const left = Math.round(remainingKcal - candidate.kcal);
  const leftClause = left <= 0 ? "uses the last of today's calories" : `leaves ${withThousands(left)} kcal`;

  // The gap it makes the biggest dent in, if any.
  const outstanding = rooms
    .filter((room) => room.gap > 0 && (candidate.grams[room.key] ?? 0) > 0)
    .map((room) => ({ room, covered: Math.min(candidate.grams[room.key] ?? 0, room.gap) }))
    .sort((a, b) => b.covered / b.room.gap - a.covered / a.room.gap);

  const best = outstanding[0];
  if (best) {
    const name = macroName(best.room.key);
    if (best.covered >= best.room.gap - 0.5) {
      return `Clears the ${Math.round(best.room.gap)}g of ${name} still to go, and ${leftClause}.`;
    }
    return `Covers ${Math.round(best.covered)}g of the ${Math.round(best.room.gap)}g of ${name} still to go, and ${leftClause}.`;
  }

  return left <= 0
    ? "Uses the last of today's calories."
    : `Leaves ${withThousands(left)} kcal of today's allowance.`;
}

/**
 * Groups thousands the way the rest of the screen does. Done by hand rather
 * than through toLocaleString so the server's locale can't quietly change how
 * a number reads next to the ones the browser formats.
 */
function withThousands(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function macroName(key: MacroKey): string {
  return key === "carbs" ? "carbs" : key;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
