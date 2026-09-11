/**
 * The user's own foods, aggregated the same way GET /api/foods does it — one
 * row per distinct food, the most recent logging of it supplying the figures,
 * with any correction laid over the top.
 *
 * Shared rather than owned by the search route: the estimate path asks the
 * same question before it calls the model (see estimateShortcut.ts), and two
 * copies of this aggregation would be two chances for them to disagree about
 * what counts as one of someone's own foods.
 */

import { prisma } from "./db";
import { normalizeLabel } from "./labelKey";
import type { LibraryRow } from "./foodSearch";

export async function loadLibrary(userId: number): Promise<LibraryRow[]> {
  const [entries, overrides] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId } },
      orderBy: { timestamp: "desc" },
      select: { label: true, kcal: true, proteinG: true, carbsG: true, fatG: true, quantity: true, unitLabel: true },
    }),
    prisma.foodOverride.findMany({ where: { userId } }),
  ]);

  const overrideByKey = new Map(overrides.map((o) => [o.labelKey, o]));
  const byKey = new Map<string, LibraryRow & { labelKey: string }>();

  for (const entry of entries) {
    const labelKey = normalizeLabel(entry.label);
    if (!labelKey) continue;
    const existing = byKey.get(labelKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(labelKey, {
      labelKey,
      label: entry.label.trim(),
      kcal: entry.kcal,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      // The amount those figures are for. Entries are newest-first, so this is
      // the most recent logging of the food — the amount someone last actually
      // ate, which is both the sensible default to re-log and the divisor that
      // turns the row into a per-unit figure.
      quantity: entry.quantity,
      unitLabel: entry.unitLabel,
      count: 1,
    });
  }

  return [...byKey.values()].map((row) => {
    const fix = overrideByKey.get(row.labelKey);
    if (!fix) return row;
    return { ...row, label: fix.label, kcal: fix.kcal, proteinG: fix.proteinG, carbsG: fix.carbsG, fatG: fix.fatG };
  });
}
