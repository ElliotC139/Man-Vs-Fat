import { prisma } from "./db";
import { config } from "./config";
import { getLocalParts, localDayKey } from "./matchWeek";
import { normalizeLabel } from "./routes/foods";

/**
 * Associations between what someone ate and how their body responded the
 * next morning, using their own WHOOP recovery and sleep data.
 *
 * Everything here is a plain difference of group means, deliberately — not a
 * model, and not a claim of causation. Someone's diet on a heavy-drinking
 * weekend also coincides with late nights and no training, so an association
 * between a food and poor recovery may be about the occasion rather than the
 * food. The thresholds below exist so only differences big enough to be worth
 * a person's attention are ever surfaced, and the wording in the UI stays on
 * "tends to coincide with" rather than "causes".
 */

const WINDOW_DAYS = 90;
/** Below this, a group mean is one bad night wearing a trenchcoat. */
const MIN_GROUP_DAYS = 6;
/** Recovery is a 0-100 score; under this many points apart isn't worth reporting. */
const MIN_RECOVERY_DELTA = 6;
/** Sleep performance is also 0-100. */
const MIN_SLEEP_DELTA = 6;
/** A food needs to appear this often before a per-food mean means anything. */
const MIN_FOOD_OCCURRENCES = 6;
/** Anything later than this counts as a late meal. */
const LATE_MEAL_HOUR = 21;

export interface FoodRecoveryFinding {
  id: string;
  /** Plain-language sentence for display. */
  text: string;
  /** Signed difference in the metric's own units (recovery/sleep-performance points). */
  deltaPoints: number;
  /** Days behind each side of the comparison, so the UI can show how much data is behind it. */
  sampleDays: number;
  metric: "recovery" | "sleep";
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The day after `dayKey`, as a day key. */
function nextDay(dayKey: string): string {
  return localDayKey(new Date(Date.parse(`${dayKey}T12:00:00Z`) + 86_400_000), config.TIMEZONE);
}

interface DayIntake {
  kcal: number;
  latestHour: number;
  foodKeys: Set<string>;
}

export async function foodRecoveryFindings(userId: number): Promise<FoodRecoveryFinding[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sinceKey = localDayKey(since, config.TIMEZONE);

  const [entries, recoveries, sleeps] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
      select: { timestamp: true, kcal: true, label: true },
    }),
    prisma.whoopRecovery.findMany({
      where: { userId, date: { gte: sinceKey }, recoveryScore: { not: null } },
      select: { date: true, recoveryScore: true },
    }),
    prisma.whoopSleep.findMany({
      where: { userId, start: { gte: since }, performancePercent: { not: null } },
      select: { start: true, performancePercent: true },
    }),
  ]);

  if (entries.length === 0 || (recoveries.length === 0 && sleeps.length === 0)) return [];

  const byDay = new Map<string, DayIntake>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    const hour = getLocalParts(e.timestamp, config.TIMEZONE).hour;
    const day = byDay.get(key) ?? { kcal: 0, latestHour: -1, foodKeys: new Set<string>() };
    day.kcal += e.kcal ?? 0;
    day.latestHour = Math.max(day.latestHour, hour);
    const foodKey = normalizeLabel(e.label);
    if (foodKey) day.foodKeys.add(foodKey);
    byDay.set(key, day);
  }

  const recoveryByDay = new Map(recoveries.map((r) => [r.date, r.recoveryScore!]));
  // A sleep is attributed to the morning it ends — that's the night whose
  // quality the previous day's eating could have affected.
  const sleepByDay = new Map<string, number>();
  for (const s of sleeps) {
    sleepByDay.set(localDayKey(s.start, config.TIMEZONE), s.performancePercent!);
  }

  const findings: FoodRecoveryFinding[] = [];
  const dayKeys = [...byDay.keys()].sort();

  /** Next-morning metric for a day of eating, or undefined if not measured. */
  const nextRecovery = (dayKey: string) => recoveryByDay.get(nextDay(dayKey));
  const nextSleep = (dayKey: string) => sleepByDay.get(nextDay(dayKey));

  // ── 1. Biggest-eating days vs lightest, against next-day recovery ────────
  const withRecovery = dayKeys.filter((k) => nextRecovery(k) !== undefined);
  if (withRecovery.length >= MIN_GROUP_DAYS * 2) {
    const sortedByKcal = [...withRecovery].sort((a, b) => byDay.get(a)!.kcal - byDay.get(b)!.kcal);
    const cut = Math.floor(sortedByKcal.length / 3);
    if (cut >= MIN_GROUP_DAYS) {
      const lightest = sortedByKcal.slice(0, cut);
      const heaviest = sortedByKcal.slice(-cut);
      const lightRecovery = mean(lightest.map((k) => nextRecovery(k)!));
      const heavyRecovery = mean(heaviest.map((k) => nextRecovery(k)!));
      const delta = Math.round(heavyRecovery - lightRecovery);
      if (Math.abs(delta) >= MIN_RECOVERY_DELTA) {
        const direction = delta < 0 ? "lower" : "higher";
        findings.push({
          id: "intake-vs-recovery",
          metric: "recovery",
          deltaPoints: delta,
          sampleDays: cut,
          text:
            `After your heaviest eating days, next-morning recovery averages ${Math.abs(delta)} points ${direction} ` +
            `than after your lightest (${Math.round(heavyRecovery)}% vs ${Math.round(lightRecovery)}%).`,
        });
      }
    }
  }

  // ── 2. Late meals vs earlier finishes, against that night's sleep ────────
  const withSleep = dayKeys.filter((k) => nextSleep(k) !== undefined && byDay.get(k)!.latestHour >= 0);
  const lateDays = withSleep.filter((k) => byDay.get(k)!.latestHour >= LATE_MEAL_HOUR);
  const earlyDays = withSleep.filter((k) => byDay.get(k)!.latestHour < LATE_MEAL_HOUR);
  if (lateDays.length >= MIN_GROUP_DAYS && earlyDays.length >= MIN_GROUP_DAYS) {
    const lateSleep = mean(lateDays.map((k) => nextSleep(k)!));
    const earlySleep = mean(earlyDays.map((k) => nextSleep(k)!));
    const delta = Math.round(lateSleep - earlySleep);
    if (Math.abs(delta) >= MIN_SLEEP_DELTA) {
      const direction = delta < 0 ? "worse" : "better";
      findings.push({
        id: "late-meals-vs-sleep",
        metric: "sleep",
        deltaPoints: delta,
        sampleDays: Math.min(lateDays.length, earlyDays.length),
        text:
          `When you eat after ${LATE_MEAL_HOUR}:00, your sleep performance that night is ${Math.abs(delta)} points ` +
          `${direction} on average (${Math.round(lateSleep)}% vs ${Math.round(earlySleep)}%).`,
      });
    }
  }

  // ── 3. Individual foods against next-day recovery ────────────────────────
  if (withRecovery.length >= MIN_GROUP_DAYS * 2) {
    const occurrencesByFood = new Map<string, string[]>();
    const labelByFood = new Map<string, string>();
    for (const e of entries) {
      const key = normalizeLabel(e.label);
      if (!key) continue;
      if (!labelByFood.has(key)) labelByFood.set(key, e.label);
      const dayKey = localDayKey(e.timestamp, config.TIMEZONE);
      if (nextRecovery(dayKey) === undefined) continue;
      const days = occurrencesByFood.get(key) ?? [];
      if (!days.includes(dayKey)) days.push(dayKey);
      occurrencesByFood.set(key, days);
    }

    const scored: { key: string; delta: number; withDays: number; withMean: number; withoutMean: number }[] = [];
    for (const [key, days] of occurrencesByFood) {
      if (days.length < MIN_FOOD_OCCURRENCES) continue;
      const withoutDays = withRecovery.filter((k) => !days.includes(k));
      if (withoutDays.length < MIN_GROUP_DAYS) continue;
      const withMean = mean(days.map((k) => nextRecovery(k)!));
      const withoutMean = mean(withoutDays.map((k) => nextRecovery(k)!));
      const delta = Math.round(withMean - withoutMean);
      if (Math.abs(delta) >= MIN_RECOVERY_DELTA) {
        scored.push({ key, delta, withDays: days.length, withMean, withoutMean });
      }
    }

    // Only the single strongest association, in each direction — a list of
    // twenty marginal food correlations is noise dressed up as insight.
    scored.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    for (const direction of [-1, 1]) {
      const best = scored.find((s) => Math.sign(s.delta) === direction);
      if (!best) continue;
      const label = labelByFood.get(best.key) ?? best.key;
      const word = best.delta < 0 ? "lower" : "higher";
      findings.push({
        id: `food-recovery-${best.key}`,
        metric: "recovery",
        deltaPoints: best.delta,
        sampleDays: best.withDays,
        text:
          `On days you log "${label}", next-morning recovery averages ${Math.abs(best.delta)} points ${word} ` +
          `than on days you don't (${best.withDays} days logged).`,
      });
    }
  }

  return findings;
}
