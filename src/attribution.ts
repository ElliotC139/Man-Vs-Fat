/**
 * Where a signup came from, recorded once and never revised.
 *
 * The funnel in src/funnel.ts answers "how many arrived and how many stayed".
 * It cannot answer "and which of the things I did caused that", which is the
 * only question that tells somebody what to do more of. Without this, every
 * post, every guide and every link is an experiment with no reading at the
 * end of it.
 *
 * ── First touch, not last ────────────────────────────────────────────────
 *
 * The source is captured when somebody first arrives and kept until they sign
 * up, however many pages later. Last-touch attribution would credit the
 * signup to whichever page happened to hold the sign-up button, which on this
 * site is always the same page, and would therefore say "the landing page" for
 * everybody and mean nothing.
 *
 * ── Deliberately small ───────────────────────────────────────────────────
 *
 * A referrer's *host*, never the full URL. Referrer-Policy is already set to
 * strict-origin-when-cross-origin in src/server.ts, so a path shouldn't reach
 * us anyway — this makes that a guarantee rather than a hope. No IP address,
 * no fingerprint, no third-party script, nothing that follows anybody around
 * another website. It is enough to tell Reddit from Google and one guide from
 * another, and that is the whole job.
 */

/** Long enough for a real campaign name, short enough not to be a payload. */
const MAX_FIELD = 120;

/** A landing path we will store. Query strings and fragments are dropped. */
const PATH_PATTERN = /^\/[A-Za-z0-9\-._~/]*$/;

export interface RawAttribution {
  referrer?: unknown;
  source?: unknown;
  campaign?: unknown;
  landing?: unknown;
}

export interface Attribution {
  /** Normalised: "google", "reddit", a bare host, or "direct". */
  source: string;
  campaign: string | null;
  /** First page on this site, e.g. "/guides/why-the-scale-lies". */
  landing: string | null;
}

/**
 * Hosts worth collapsing to a name.
 *
 * Search engines and the big social apps arrive under several hostnames each —
 * google.co.uk and google.com, m.facebook.com and l.facebook.com, half a dozen
 * Reddit subdomains — and counting those separately turns one real answer into
 * a scattered list. Everything else is kept as its host, because an unexpected
 * host is exactly the interesting case.
 */
const KNOWN: { match: RegExp; name: string }[] = [
  { match: /(^|\.)google\./, name: "google" },
  { match: /(^|\.)bing\./, name: "bing" },
  { match: /(^|\.)duckduckgo\./, name: "duckduckgo" },
  { match: /(^|\.)reddit\.com$/, name: "reddit" },
  { match: /(^|\.)facebook\.com$/, name: "facebook" },
  { match: /(^|\.)instagram\.com$/, name: "instagram" },
  { match: /(^|\.)whatsapp\.com$/, name: "whatsapp" },
  { match: /(^|\.)t\.co$/, name: "twitter" },
  { match: /(^|\.)x\.com$/, name: "twitter" },
  { match: /(^|\.)linkedin\.com$/, name: "linkedin" },
  { match: /(^|\.)youtube\.com$/, name: "youtube" },
  { match: /(^|\.)chatgpt\.com$/, name: "chatgpt" },
  { match: /(^|\.)perplexity\.ai$/, name: "perplexity" },
  { match: /(^|\.)claude\.ai$/, name: "claude" },
];

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_FIELD);
  return trimmed.length > 0 ? trimmed : null;
}

/** The host of a referrer, or null for anything that isn't a usable URL. */
function hostOf(referrer: string | null): string | null {
  if (referrer === null) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return host.length > 0 ? host : null;
  } catch {
    // Not a URL. Some browsers and in-app webviews send odd values here, and a
    // signup must never fail because one of them did.
    return null;
  }
}

/**
 * Works out the one word that answers "where did this person come from".
 *
 * An explicit utm_source wins, because it was put there on purpose and is more
 * specific than anything that can be inferred — a link shared into a WhatsApp
 * group arrives with no referrer at all, and tagging it is the only way to
 * tell it from somebody typing the address in.
 */
export function attributionFrom(raw: RawAttribution, ownHost: string): Attribution {
  const campaign = clean(raw.campaign);
  const explicit = clean(raw.source);
  if (explicit !== null) {
    return { source: explicit.toLowerCase(), campaign, landing: landingFrom(raw.landing) };
  }

  const host = hostOf(clean(raw.referrer));
  if (host === null || host === ownHost.toLowerCase().replace(/^www\./, "")) {
    // Our own pages are not a source; somebody who read three guides before
    // signing up still arrived from wherever they originally came from, and
    // if that was nowhere then it was direct.
    return { source: "direct", campaign, landing: landingFrom(raw.landing) };
  }

  const known = KNOWN.find((entry) => entry.match.test(host));
  return { source: known?.name ?? host, campaign, landing: landingFrom(raw.landing) };
}

function landingFrom(value: unknown): string | null {
  const path = clean(value);
  if (path === null) return null;
  // Only a plain path. A query string can carry anything, including whatever
  // somebody decided to append to a link, and none of it belongs in a column
  // that exists to count arrivals.
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "";
  if (!PATH_PATTERN.test(withoutQuery)) return null;
  return withoutQuery.slice(0, MAX_FIELD);
}
