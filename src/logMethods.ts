/**
 * Which ways into the diary the log form offers.
 *
 * The form has grown a button at a time — a barcode scanner, a database
 * search, a voice button, and most recently a plain number — and four of them
 * across a phone is a row of choices where most people only ever use one. This
 * turns the row into a preference.
 *
 * The typed box is not in the list. It is the form itself, and a log screen
 * with no way to log is not a preference anybody holds.
 *
 * "number" is off by default and the rest are on. It is the one that skips the
 * estimate entirely, which is the right tool occasionally — a figure you
 * already know, a slow connection — and the wrong default always: a diary
 * whose easiest path is "type a number you guessed" is a worse diary.
 */

export const LOG_METHODS = ["photo", "scan", "search", "speak", "number"] as const;
export type LogMethod = (typeof LOG_METHODS)[number];

/** What the form offered before this was a choice, plus number, off. */
export const DEFAULT_LOG_METHODS: LogMethod[] = ["photo", "scan", "search", "speak"];

export const LOG_METHOD_NAMES: Record<LogMethod, string> = {
  photo: "Photo",
  scan: "Barcode",
  search: "Search",
  speak: "Voice",
  number: "Number",
};

/**
 * What each one is for, in the settings list. Written as what it does rather
 * than what it is called, because "Barcode" already says the name.
 */
export const LOG_METHOD_NOTES: Record<LogMethod, string> = {
  photo: "Attach a picture of the meal, or estimate from one.",
  scan: "Read a packet's barcode and take its published figures.",
  search: "Look a food up in the databases, including restaurant menus.",
  speak: "Dictate instead of typing. Hidden anyway where the browser can't.",
  number: "Log a calorie figure you already know, with no estimate at all.",
};

export interface LogMethodUser {
  logMethods?: string | null;
}

/**
 * The methods this account wants, in the order the form lays them out.
 *
 * An unreadable column reads as the default rather than as nothing: the worst
 * a bad row should cost is a preference not being honoured, never a log form
 * with no buttons on it.
 *
 * An empty list is a real answer here, unlike the diary's figures — someone
 * who only ever types can legitimately want all four gone, and the typed box
 * remains either way. So [] round-trips as [], and only a missing or
 * unparseable column falls back.
 */
export function readLogMethods(user: LogMethodUser | null | undefined): LogMethod[] {
  const raw = user?.logMethods;
  if (raw === null || raw === undefined || raw === "") return [...DEFAULT_LOG_METHODS];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...DEFAULT_LOG_METHODS];
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_LOG_METHODS];

  return LOG_METHODS.filter((method) => parsed.includes(method));
}

/** Serialises a chosen set back to the column, in the canonical order. */
export function writeLogMethods(methods: readonly string[]): string {
  return JSON.stringify(LOG_METHODS.filter((method) => methods.includes(method)));
}
