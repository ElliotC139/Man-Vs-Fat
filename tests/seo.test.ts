import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

import { planFor } from "../src/plans";

/**
 * The metadata nobody looks at until it is wrong.
 *
 * Page metadata rots in a way that is invisible from inside the app: the
 * pages render identically whether the canonical URL is right, whether the
 * structured data still agrees with the prices, or whether the app shell has
 * quietly become indexable. Nothing fails, nothing looks broken, and the first
 * symptom is months later in somebody else's search results.
 *
 * Two of these are load-bearing rather than tidiness:
 *
 *   - index.html must stay noindex, because /s/:token serves it. A share
 *     token is unguessable, but an indexed URL is a public one.
 *   - the FAQ schema must stay identical to the visible FAQ, because Google
 *     penalises the mismatch and because a schema that has drifted from the
 *     copy is a machine-readable lie about the product.
 */

const read = (name: string) => readFileSync(path.join(process.cwd(), "public", name), "utf8");

/** Pages a stranger is meant to find. */
const INDEXABLE = ["landing.html", "privacy.html", "terms.html"] as const;

/** Pages that must never appear in a search result, and why. */
const PRIVATE: Record<string, string> = {
  "index.html": "the app shell, also served for /s/:token share links",
  "404.html": "a dead end",
  "reset.html": "a troubleshooting page",
};

const CANONICAL: Record<string, string> = {
  "landing.html": "https://quickcals.com/",
  "privacy.html": "https://quickcals.com/privacy.html",
  "terms.html": "https://quickcals.com/terms.html",
};

function meta(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta\\s+name="${name}"[^>]*content="([^"]*)"`, "i"))
    // The description tags are written across several lines in some pages.
    ?? html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "is"))
    ?? html.match(new RegExp(`name="${name}"\\s+content="([^"]*)"`, "is"));
  return match?.[1] ?? null;
}

describe("what every page tells a crawler", () => {
  it.each([...INDEXABLE, ...Object.keys(PRIVATE)])("%s has a title", (page) => {
    const title = read(page).match(/<title>(.*?)<\/title>/s)?.[1]?.trim();
    expect(title, `${page} has no <title>`).toBeTruthy();
    expect(title).toContain("QuicKcals");
  });

  it.each(INDEXABLE)("%s has a description worth showing in a result", (page) => {
    const description = meta(read(page), "description");
    expect(description, `${page} has no description`).toBeTruthy();
    // Google truncates around 155 characters and shows nothing useful under
    // about 50, which is what "Privacy policy for QuicKcals." used to be.
    expect(description!.length).toBeGreaterThan(60);
  });

  it.each(INDEXABLE)("%s declares which URL is the real one", (page) => {
    const canonical = read(page).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical).toBe(CANONICAL[page]);
  });

  it.each(Object.entries(PRIVATE))("%s is noindex — %s", (page) => {
    expect(meta(read(page), "robots")).toMatch(/noindex/);
  });

  it("keeps the app shell out of the index, share links included", () => {
    // Called out separately from the table above because this one is a privacy
    // boundary rather than housekeeping: /s/:token serves this exact file.
    expect(meta(read("index.html"), "robots")).toMatch(/noindex/);
    expect(read("robots.txt")).toMatch(/Disallow: \/s\//);
  });

  it("never points a crawler at the API or someone's upload", () => {
    const robots = read("robots.txt");
    expect(robots).toMatch(/Disallow: \/api\//);
    expect(robots).toMatch(/Disallow: \/uploads\//);
    expect(robots).toMatch(/Sitemap: https:\/\/quickcals\.com\/sitemap\.xml/);
  });

  it("lists exactly the indexable pages in the sitemap", () => {
    const sitemap = read("sitemap.xml");
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect([...listed].sort()).toEqual(Object.values(CANONICAL).sort());
  });

  it("does not put a private page in the sitemap", () => {
    const sitemap = read("sitemap.xml");
    for (const page of Object.keys(PRIVATE)) {
      expect(sitemap, `${page} is in the sitemap`).not.toContain(page);
    }
  });
});

describe("the link preview people actually see", () => {
  it("gives the landing page a full-width card, not a thumbnail", () => {
    const html = read("landing.html");
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(html).toMatch(/property="og:image" content="https:\/\/quickcals\.com\//);
  });

  it.each(INDEXABLE)("%s has an og:title and og:url", (page) => {
    const html = read(page);
    expect(html).toMatch(/property="og:title"/);
    expect(html.match(/property="og:url" content="([^"]+)"/)?.[1]).toBe(CANONICAL[page]);
  });
});

// ── structured data ────────────────────────────────────────────────────────

interface Graph {
  "@graph": Record<string, any>[];
}

function graph(): Graph["@graph"] {
  const block = read("landing.html").match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  expect(block, "landing.html has no JSON-LD").toBeTruthy();
  return (JSON.parse(block!) as Graph)["@graph"];
}

const node = (type: string) => graph().find((n) => n["@type"] === type)!;

/** The same normalisation the generator used, so the comparison is exact. */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleFaq(): { question: string; answer: string }[] {
  const section = read("landing.html").split("Questions people actually ask")[1] ?? "";
  return [...section.matchAll(/<details>\s*<summary>(.*?)<\/summary>\s*<p>(.*?)<\/p>\s*<\/details>/gs)]
    .map((m) => ({ question: plainText(m[1] ?? ""), answer: plainText(m[2] ?? "") }));
}

describe("structured data, which is what an answer engine reads", () => {
  it("parses as JSON and describes the app, the site and the FAQ", () => {
    const types = graph().map((n) => n["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]),
    );
  });

  it("quotes the same prices the app actually charges", () => {
    // The whole point of this test. Prices are not editable from the admin
    // tier editor, so src/plans.ts is the truth — but a price change there and
    // a forgotten edit here would leave the machine-readable version of the
    // pricing quietly wrong, which is the worst place for it to be wrong.
    const offers = node("SoftwareApplication").offers as { name: string; price: string }[];
    const priced = (label: string) => offers.find((o) => o.name === label)!;

    for (const id of ["plus", "pro"] as const) {
      const plan = planFor(id);
      expect(priced(`${plan.name} (monthly)`).price).toBe((plan.pricePence / 100).toFixed(2));
      expect(priced(`${plan.name} (yearly)`).price).toBe((plan.yearlyPence! / 100).toFixed(2));
    }
    expect(priced("Free (monthly)").price).toBe("0.00");
  });

  it("prices every offer in the currency the app bills in", () => {
    const offers = node("SoftwareApplication").offers as { priceCurrency: string }[];
    expect(offers.every((o) => o.priceCurrency === "GBP")).toBe(true);
  });

  it("asks a question in the schema for every question on the page", () => {
    const asked = visibleFaq().map((f) => f.question);
    const declared = (node("FAQPage").mainEntity as { name: string }[]).map((q) => q.name);
    expect(declared).toEqual(asked);
  });

  it("gives the schema answer verbatim from the page", () => {
    // Google demotes a page whose FAQ markup differs from the visible copy,
    // and an answer that has drifted is worse than no markup at all: it is a
    // claim about the product that nobody proof-reads.
    const visible = visibleFaq();
    const declared = node("FAQPage").mainEntity as { acceptedAnswer: { text: string } }[];
    declared.forEach((entry, i) => {
      expect(entry.acceptedAnswer.text).toBe(visible[i]?.answer);
    });
  });

  it("does not claim a live Apple Health connection anywhere in the schema", () => {
    // The claim that was removed from the copy for being untrue. Structured
    // data is exactly where it would survive the cleanup unnoticed.
    const asText = JSON.stringify(graph()).toLowerCase();
    expect(asText).not.toMatch(/sync(s|ing)? with apple health/);
    expect(asText).not.toMatch(/connects? to apple health/);
  });
});

describe("llms.txt", () => {
  it("states the prices the app actually charges", () => {
    const text = read("llms.txt");
    for (const id of ["plus", "pro"] as const) {
      const plan = planFor(id);
      expect(text).toContain(`£${(plan.pricePence / 100).toFixed(2)}/month`);
      expect(text).toContain(`£${(plan.yearlyPence! / 100).toFixed(2)}/year`);
    }
  });

  it("points at pages that exist", () => {
    const links = [...read("llms.txt").matchAll(/https:\/\/quickcals\.com(\/[^\s)]*)/g)]
      .map((m) => m[1] ?? "")
      .filter((p) => p.endsWith(".html"));
    for (const link of new Set(links)) {
      expect(Object.values(CANONICAL)).toContain(`https://quickcals.com${link}`);
    }
  });
});
