import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/**
 * Two settings SQLite does not default to, and both of them matter the moment
 * more than one person uses the app at once.
 *
 * ── journal_mode = WAL ────────────────────────────────────────────────────
 *
 * SQLite's default is `delete`, where a write takes a lock over the whole
 * database and every reader waits for it. One person never notices. A hundred
 * do: each logged meal, weigh-in and settings change stalls everyone else's
 * page for as long as the write takes, and the symptom is requests that are
 * occasionally slow for no reason anybody can reproduce.
 *
 * Write-ahead logging lets readers carry on against the last committed state
 * while a writer appends. Readers stop blocking, writers stop queueing behind
 * readers, and only writer-against-writer contention is left — which for a
 * food diary is a handful of writes per person per day.
 *
 * It is a property of the database file rather than the connection, so this
 * runs once and sticks. Nothing about the data changes; it is purely how the
 * file is written to.
 *
 * ── busy_timeout ─────────────────────────────────────────────────────────
 *
 * Without it, a connection that finds the database locked gives up at once
 * and the request fails with SQLITE_BUSY — a 500 for what is really "wait
 * three milliseconds". With it, the connection waits.
 *
 * Best-effort, and the difference matters: unlike the journal mode this is a
 * property of a CONNECTION, not of the file. It lands on whichever pooled
 * connection runs it, and Prisma may hold others. So it is worth setting and
 * not worth relying on — WAL is the change that does the real work here,
 * because it removes most of the contention this would otherwise have to
 * wait out.
 */
const BUSY_TIMEOUT_MS = 5_000;

export async function tuneDatabase(): Promise<void> {
  try {
    // $queryRawUnsafe for both, not $executeRaw. Setting a pragma RETURNS the
    // value it settled on, and Prisma's SQLite connector refuses to run a
    // statement that returns rows through $executeRaw — "Execute returned
    // results, which is not allowed in SQLite". Reading the answer back is
    // the point anyway: a pragma that quietly failed to apply is exactly what
    // this function exists to make visible.
    const [journal] = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
      "PRAGMA journal_mode = WAL",
    );
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);

    const mode = journal?.journal_mode ?? "unknown";
    console.log(`SQLite journal mode: ${mode} (busy timeout ${BUSY_TIMEOUT_MS}ms)`);
    if (mode.toLowerCase() !== "wal") {
      // Said plainly rather than left to be inferred from a mode nobody reads:
      // on the default journal every write locks out every reader, which is a
      // performance cliff that only appears once several people are using it.
      console.warn(`SQLite is on '${mode}', not WAL — writes will block reads under load.`);
    }
  } catch (error) {
    // Never fatal. A database that won't take a pragma still serves every
    // request it served before — slower under load, but serving. Taking the
    // app down over a performance setting would be the worse trade.
    console.error("Could not apply the SQLite pragmas; continuing on defaults:", error);
  }
}
