/**
 * Filling in the macros that were never worked out.
 *
 * Everything logged before macros existed has calories and nothing else, and
 * so does anything the estimator couldn't break down. Those rows are honestly
 * marked — the diary says the day's totals are short by whatever was in them —
 * but "honestly incomplete" is still incomplete, and it keeps a food out of
 * the "what still fits" card for good.
 *
 * This is the one-off that closes them out. Two things make it affordable and
 * safe to run over years of diary:
 *
 *   Grouped by food, not by entry. Two hundred rows that all say "Sandwich"
 *   are one question, asked once, and the answer applied to all of them.
 *
 *   The calories are left alone. They were confirmed by the user at the time;
 *   only the macros are missing. So the estimate is used for the *ratio* of
 *   protein to carbs to fat, scaled to the calories each row already has —
 *   a 380 kcal porridge and a 760 kcal one get their own figures rather than
 *   both being handed whatever the model thought one bowl was.
 */

import { prisma } from "./db";
import { estimateMeal } from "./estimate";
import { clampMacrosToKcal } from "./macros";
import { normalizeLabel } from "./routes/foods";
import { recordError } from "./errorLog";

/** How many distinct foods one request works through. */
export const BACKFILL_BATCH = 8;

export interface MacroBackfillStatus {
  /** Entries with calories but no macro breakdown at all. */
  entries: number;
  /** How many distinct foods those come to — the number of questions to ask. */
  foods: number;
}

export interface MacroBackfillResult extends MacroBackfillStatus {
  /** Entries given macros by this batch. */
  updated: number;
  /** Foods this batch couldn't work out, and won't be retried in a later one. */
  failed: string[];
  /** True when there is nothing left to do. */
  done: boolean;
}

interface MissingGroup {
  labelKey: string;
  label: string;
  entryIds: number[];
  kcalById: Map<number, number>;
}

/**
 * A row counts as missing only when all three macros are absent. One that
 * genuinely has none of a macro carries a zero, not a null (see sumMacros), so
 * this can't mistake a black coffee for an unanswered question.
 */
async function loadMissing(userId: number): Promise<MissingGroup[]> {
  const entries = await prisma.entry.findMany({
    where: {
      matchWeek: { userId },
      kcal: { not: null },
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
    orderBy: { timestamp: "desc" },
    select: { id: true, label: true, kcal: true },
  });

  const groups = new Map<string, MissingGroup>();
  for (const entry of entries) {
    const labelKey = normalizeLabel(entry.label);
    if (!labelKey) continue;
    let group = groups.get(labelKey);
    if (!group) {
      group = { labelKey, label: entry.label.trim(), entryIds: [], kcalById: new Map() };
      groups.set(labelKey, group);
    }
    group.entryIds.push(entry.id);
    group.kcalById.set(entry.id, entry.kcal!);
  }

  // Most-logged first, so the foods that make the biggest difference to the
  // diary are the ones filled in by an interrupted run.
  return [...groups.values()].sort((a, b) => b.entryIds.length - a.entryIds.length);
}

export async function macroBackfillStatus(userId: number): Promise<MacroBackfillStatus> {
  const groups = await loadMissing(userId);
  return { entries: groups.reduce((sum, g) => sum + g.entryIds.length, 0), foods: groups.length };
}

export async function runMacroBackfill(userId: number, batch = BACKFILL_BATCH): Promise<MacroBackfillResult> {
  const groups = await loadMissing(userId);
  const slice = groups.slice(0, batch);

  let updated = 0;
  const failed: string[] = [];

  for (const group of slice) {
    let ratio: { protein: number; carbs: number; fat: number; kcal: number } | null = null;
    try {
      const [item] = await estimateMeal({ text: group.label });
      if (item && item.kcal && item.kcal > 0 && (item.proteinG !== null || item.carbsG !== null || item.fatG !== null)) {
        ratio = {
          kcal: item.kcal,
          protein: item.proteinG ?? 0,
          carbs: item.carbsG ?? 0,
          fat: item.fatG ?? 0,
        };
      }
    } catch (error) {
      void recordError("macroBackfill.estimate", error, userId);
    }

    if (!ratio) {
      failed.push(group.label);
      continue;
    }

    for (const id of group.entryIds) {
      const kcal = group.kcalById.get(id)!;
      // The model's own calorie figure is only ever used as the denominator
      // here — the row keeps the calories it already had.
      const factor = kcal / ratio.kcal;
      const scaled = clampMacrosToKcal(
        {
          protein: round1(ratio.protein * factor),
          carbs: round1(ratio.carbs * factor),
          fat: round1(ratio.fat * factor),
        },
        kcal,
      );
      await prisma.entry.update({
        where: { id },
        data: {
          proteinG: round1(scaled.protein),
          carbsG: round1(scaled.carbs),
          fatG: round1(scaled.fat),
        },
      });
      updated += 1;
    }
  }

  const remaining = await macroBackfillStatus(userId);
  return {
    ...remaining,
    updated,
    failed,
    // A food the estimator couldn't answer for stays in the count for ever, so
    // "done" has to mean "nothing left that this run can move", not "the count
    // reached zero" — otherwise the client loops until it gives up.
    done: slice.length === 0 || updated === 0,
  };
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}
