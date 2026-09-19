import { describe, expect, it } from "vitest";
import { attributionFrom } from "../src/attribution";

/**
 * The column that decides what gets built and written next.
 *
 * A funnel that is wrong is obvious — the numbers don't add up. A *source*
 * that is wrong is not: it looks like an answer, and it sends somebody off
 * writing more of whatever it credited. So these are mostly about the ways a
 * source can be quietly mis-assigned.
 */

const OWN = "quickcals.com";
const from = (raw: Parameters<typeof attributionFrom>[0]) => attributionFrom(raw, OWN);

describe("naming the source", () => {
  it("collapses a search engine's many hostnames to one name", () => {
    // google.co.uk and google.com are one finding, not two.
    for (const host of ["https://www.google.com/", "https://google.co.uk/search?q=x", "https://images.google.de/"]) {
      expect(from({ referrer: host }).source).toBe("google");
    }
  });

  it("collapses the subdomains a big site links from", () => {
    expect(from({ referrer: "https://old.reddit.com/r/loseit/comments/x" }).source).toBe("reddit");
    expect(from({ referrer: "https://www.reddit.com/r/loseit" }).source).toBe("reddit");
    expect(from({ referrer: "https://m.facebook.com/" }).source).toBe("facebook");
  });

  it("keeps an unrecognised host as itself", () => {
    // An unexpected referrer is the interesting case, so it is reported rather
    // than filed under "other".
    expect(from({ referrer: "https://www.menshealth.co.uk/article" }).source).toBe("menshealth.co.uk");
  });

  it("never counts our own pages as a source", () => {
    // Somebody who read three guides before signing up still came from
    // wherever they originally came from.
    expect(from({ referrer: "https://quickcals.com/guides/why-the-scale-lies" }).source).toBe("direct");
    expect(from({ referrer: "https://www.quickcals.com/" }).source).toBe("direct");
  });

  it("calls a visit with no referrer direct", () => {
    expect(from({}).source).toBe("direct");
    expect(from({ referrer: "" }).source).toBe("direct");
  });

  it("prefers an explicit tag over anything inferred", () => {
    // The only way to identify a link pasted into a group chat: those arrive
    // with no referrer at all and are otherwise indistinguishable from
    // somebody typing the address in.
    expect(from({ source: "whatsapp-team", referrer: "https://google.com/" }).source).toBe("whatsapp-team");
  });

  it("lower-cases a tag so one campaign isn't two rows", () => {
    expect(from({ source: "Reddit" }).source).toBe("reddit");
  });

  it("survives a referrer that isn't a URL", () => {
    // In-app browsers send odd values here, and a signup must never fail
    // because one of them did.
    for (const junk of ["android-app://com.example", "not a url", "://", 42, null]) {
      expect(() => from({ referrer: junk })).not.toThrow();
    }
    expect(from({ referrer: "not a url" }).source).toBe("direct");
  });
});

describe("the landing page", () => {
  it("keeps the path, which is the point", () => {
    // "reddit sent 40" and "the plateau guide converted 12" are different
    // findings, and the second is the one that says what to write next.
    expect(from({ landing: "/guides/why-the-weight-stopped-moving" }).landing)
      .toBe("/guides/why-the-weight-stopped-moving");
  });

  it("drops the query string and fragment", () => {
    // A query can carry whatever somebody appended to a link, and none of it
    // belongs in a column that exists to count arrivals.
    expect(from({ landing: "/guides/x?utm_source=a&token=secret" }).landing).toBe("/guides/x");
    expect(from({ landing: "/guides/x#section" }).landing).toBe("/guides/x");
  });

  it("refuses anything that isn't a plain path", () => {
    for (const bad of ["https://elsewhere.com/", "guides/x", "<script>", 7, null]) {
      expect(from({ landing: bad }).landing).toBeNull();
    }
  });
});

describe("what it deliberately does not keep", () => {
  it("stores a host, never the page somebody was reading", () => {
    // Referrer-Policy already limits this; the parser makes it a guarantee.
    const result = from({ referrer: "https://www.reddit.com/r/loseit/comments/abc/my_weight_loss" });
    expect(JSON.stringify(result)).not.toContain("my_weight_loss");
    expect(JSON.stringify(result)).not.toContain("/r/loseit");
  });

  it("caps every field so none of them is a payload", () => {
    const long = "x".repeat(5000);
    const result = from({ source: long, campaign: long, landing: `/${long}` });
    expect(result.source.length).toBeLessThanOrEqual(120);
    expect(result.campaign!.length).toBeLessThanOrEqual(120);
    expect(result.landing!.length).toBeLessThanOrEqual(120);
  });

  it("reports no campaign rather than an empty one", () => {
    expect(from({ campaign: "   " }).campaign).toBeNull();
    expect(from({}).campaign).toBeNull();
  });
});
