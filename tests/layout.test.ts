import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The bar at the bottom and the screens that have to clear it.
 *
 * `.tab-bar` is `position: fixed`, so it floats over whatever is behind it.
 * Every screen that shows it therefore needs bottom padding of its own, and
 * that padding lives in one selector list in style.css.
 *
 * Nothing about adding a screen makes you add a line to that list. The screen
 * renders, scrolls, and looks right — until you reach the end of a long one
 * and find the last card sitting under the bar. That is exactly how the Admin
 * screen shipped: it became its own screen, and the selector list was never
 * touched.
 *
 * So this derives the screens from the markup rather than restating them, and
 * fails when one is missing. A hardcoded second list would drift the same way
 * the first one did.
 */

const read = (name: string) => readFileSync(path.join(process.cwd(), "public", name), "utf8");

/**
 * Screens that deliberately hide the bar, and so need no clearance.
 *
 * Both call showTabBar(false) — sign-in stands alone, and onboarding is a
 * flow with its own Next button rather than somewhere you navigate around.
 * Keep this in step with the showTabBar(false) calls in app.js.
 */
const NO_TAB_BAR = new Set(["auth-screen", "onboarding-screen"]);

describe("clearing the tab bar", () => {
  const html = read("index.html");
  const css = read("style.css");

  /** Every screen in the markup that has a <main> for its content to scroll in. */
  const screensWithMain = [...html.matchAll(/<div id="([a-z-]+-screen)"[^>]*>([\s\S]*?)(?=<div id="[a-z-]+-screen"|<\/body>)/g)]
    .filter(([, , body]) => /<main[\s>]/.test(body!))
    .map(([, id]) => id!);

  /** The one selector list that grants the clearance. */
  const clearanceSelectors = () => {
    const rule = css.match(
      /#today-screen main,[\s\S]*?\{\s*padding-bottom: calc\(84px \+ env\(safe-area-inset-bottom\)\);/,
    );
    expect(rule, "the tab-bar clearance rule has moved or been rewritten").not.toBeNull();
    return rule![0];
  };

  it("finds the screens in the markup, so this test cannot go stale", () => {
    // A guard on the guard: if the regex above stops matching the markup this
    // whole file would pass by testing nothing at all.
    expect(screensWithMain.length).toBeGreaterThanOrEqual(6);
    expect(screensWithMain).toContain("admin-screen");
  });

  it("every screen that shows the bar has room for it", () => {
    const rule = clearanceSelectors();
    const missing = screensWithMain
      .filter((id) => !NO_TAB_BAR.has(id))
      .filter((id) => !rule.includes(`#${id} main`));

    expect(
      missing,
      `these screens hide their last card behind the tab bar: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("the screens that hide the bar really do hide it", () => {
    // NO_TAB_BAR is an exemption list, and an exemption nobody re-checks is
    // how a screen ends up excused from a rule it actually needs.
    const js = read("app.js");
    expect(js).toMatch(/function showAuthScreen\(\)[\s\S]{0,400}showTabBar\(false\)/);
    expect(js).toMatch(/function openOnboarding\(\)[\s\S]{0,200}showTabBar\(false\)/);
  });
});
