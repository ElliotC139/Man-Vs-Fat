import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { normalizeLabel } from "./foods";
import {
  cacheGet,
  cacheSet,
  rankResults,
  searchLibrary,
  type LibraryRow,
} from "../foodSearch";
import { configuredSources, lookupBarcode, searchAllProviders } from "../foodSearchProviders";

export const foodSearchRouter = Router();
foodSearchRouter.use(requireAuth);

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 24;
const LIBRARY_LIMIT = 6;

/**
 * One search across everything.
 *
 * The remote sources are asked in parallel and the results merged, so the
 * answer arrives as fast as the slowest source that actually replies rather
 * than one after another. Their own diary is searched at the same time and
 * always comes first: the meal they had last Tuesday is a better answer, at
 * better figures, than anything a database can offer.
 */
foodSearchRouter.get("/", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < MIN_QUERY_LENGTH) {
    res.json({ query, results: [], sources: configuredSources() });
    return;
  }

  const kinds = typeof req.query.kind === "string" ? req.query.kind.split(",").filter(Boolean) : [];

  // Only the remote half is cached. Their own foods change every time they log
  // something, and are cheap to read anyway.
  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);

  const [libraryRows, remote] = await Promise.all([
    loadLibrary(req.userId!),
    cached ?? searchAllProviders(query),
  ]);
  if (!cached) cacheSet(cacheKey, remote);

  const all = [...searchLibrary(libraryRows, query, LIBRARY_LIMIT), ...remote];
  const filtered = kinds.length > 0 ? all.filter((r) => kinds.includes(r.kind)) : all;

  res.json({
    query,
    results: rankResults(filtered, query, MAX_RESULTS),
    sources: configuredSources(),
  });
});

/**
 * The user's own foods, aggregated the same way GET /api/foods does it — one
 * row per distinct food, the most recent logging of it supplying the figures,
 * with any correction laid over the top.
 */
async function loadLibrary(userId: number): Promise<LibraryRow[]> {
  const [entries, overrides] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId } },
      orderBy: { timestamp: "desc" },
      select: { label: true, kcal: true, proteinG: true, carbsG: true, fatG: true },
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
      count: 1,
    });
  }

  return [...byKey.values()].map((row) => {
    const fix = overrideByKey.get(row.labelKey);
    if (!fix) return row;
    return { ...row, label: fix.label, kcal: fix.kcal, proteinG: fix.proteinG, carbsG: fix.carbsG, fatG: fix.fatG };
  });
}

/**
 * One barcode. Cached on both sides: here so a product looked up by one person
 * costs nothing for the next, and in the phone's own storage so a shelf with no
 * signal still scans (see the barcode cache in public/app.js).
 */
foodSearchRouter.get("/barcode/:code", async (req, res) => {
  const barcode = String(req.params.code ?? "").replace(/\D/g, "");
  if (barcode.length < 6 || barcode.length > 14) {
    res.status(400).json({ error: "That doesn't look like a barcode." });
    return;
  }

  const cacheKey = `barcode:${barcode}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.json({ barcode, product: cached[0] ?? null });
    return;
  }

  const product = await lookupBarcode(barcode);
  // A miss is cached too — asking three databases again for a barcode none of
  // them has ever heard of is the same answer at three times the cost.
  cacheSet(cacheKey, product ? [product] : []);
  res.json({ barcode, product });
});
