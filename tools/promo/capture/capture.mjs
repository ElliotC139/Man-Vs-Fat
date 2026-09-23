// Films the real app for the promo, frame by frame.
//
//   node tools/promo/capture/capture.mjs [--only today,log] [--debug]
//
// Needs the app running on localhost:3000 with the demo account from seed.mjs
// (see ../README.md for the whole sequence). Writes JPEG frames, 60 per
// second of footage, to tools/promo/capture/clips/<clip>/.
//
// The page runs on the virtual clock in clock.js, and the network is treated
// as instant: before each frame the script waits for every request in flight
// to finish, so a slow response never shows up as a stall in the footage.
// Where a pause *should* show — "Estimating…" while the AI thinks — the
// response is held back deliberately with hold().

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFonts } from './fonts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const root = require('node:child_process').execSync('npm root -g').toString().trim();
    return require(join(root, 'playwright'));
  }
}

const BASE = 'http://localhost:3000';
const FPS = 60;
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const debug = args.includes('--debug');

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, // iPhone 15 Pro
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
  reducedMotion: 'no-preference',
  locale: 'en-GB',
  timezoneId: 'Europe/London',
});
await serveFonts(ctx);
await ctx.addInitScript({ path: join(here, 'clock.js') });
await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: 'elliot', password: 'promo-demo-password' } });

/* ── Network bookkeeping ─────────────────────────────────────────── */

const inflight = new Set();
const held = new Set();
ctx.on('request', (r) => {
  inflight.add(r);
  if (debug && r.url().includes('/api/')) console.log('  →', r.method(), r.url().replace(BASE, ''));
});
const done = (r) => inflight.delete(r);
ctx.on('requestfinished', done);
ctx.on('requestfailed', done);

// Holds the next request matching `pattern` until release() is called.
async function hold(pattern) {
  let release;
  const gate = new Promise((r) => (release = r));
  await ctx.route(
    pattern,
    async (route) => {
      held.add(route.request());
      await gate;
      held.delete(route.request());
      await route.fallback();
    },
    { times: 1 },
  );
  return () => release();
}

async function quiet() {
  const until = Date.now() + 5000;
  for (;;) {
    const busy = [...inflight].filter((r) => !held.has(r) && !/fonts\.g/.test(r.url()));
    if (!busy.length || Date.now() > until) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  // Lets the response's promise chain run before the next frame.
  await new Promise((r) => setTimeout(r, 12));
}

/* ── The AI, stood in for ────────────────────────────────────────── */

// The estimate the "AI" returns for the typed dinner. Shaped exactly like
// POST /api/entries/preview's real answer.
const DINNER = {
  items: [
    { label: 'Salmon fillet', kcal: 290, proteinG: 31, carbsG: 0, fatG: 18, quantity: 140, unitLabel: 'g' },
    { label: 'New potatoes', kcal: 150, proteinG: 4, carbsG: 34, fatG: 0, quantity: 200, unitLabel: 'g' },
    { label: 'Green beans', kcal: 25, proteinG: 2, carbsG: 4, fatG: 0, quantity: 80, unitLabel: 'g' },
    { label: 'Butter', kcal: 74, proteinG: 0, carbsG: 0, fatG: 8, quantity: 10, unitLabel: 'g' },
  ],
  imageUrl: null,
  rawInput: 'salmon, new potatoes and green beans',
  source: 'ai',
  from: null,
};
await ctx.route('**/api/entries/preview', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DINNER) }),
);

/* ── Camera ──────────────────────────────────────────────────────── */

const page = await ctx.newPage();
page.on('console', (m) => debug && m.type() === 'error' && console.log('  page:', m.text()));
let dir = null;
let current = null;
let n = 0;
// Moments worth a sound or a caption, by clip and frame: markers.json.
const markers = {};
const mark = (what) => current && dir && markers[current].push({ frame: n, what });

function clip(name) {
  dir = join(here, 'clips', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  n = 0;
  current = name;
  markers[name] = [];
  console.log(`● ${name}`);
}

async function frame(record = true) {
  await quiet();
  await page.evaluate((ms) => window.__clock.advance(ms), 1000 / FPS);
  if (!record || !dir) return;
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
  writeFileSync(join(dir, `${String(++n).padStart(5, '0')}.jpg`), jpg);
}
const wait = async (s, record = true) => {
  for (let i = 0; i < Math.round(s * FPS); i++) await frame(record);
};

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
async function scrollTo(target, s, record = true) {
  const from = await page.evaluate(() => scrollY);
  const to =
    typeof target === 'number'
      ? target
      : await page.evaluate(([sel, off]) => document.querySelector(sel).getBoundingClientRect().top + scrollY - off, target);
  const frames = Math.round(s * FPS);
  for (let i = 1; i <= frames; i++) {
    await page.evaluate((y) => scrollTo(0, y), from + (to - from) * ease(i / frames));
    await frame(record);
  }
}

// A finger: a soft grey dot that presses and lifts, the way iOS screen
// recordings show touches. It runs as a CSS animation, so the clock drives it.
async function touch(selector) {
  const box = await page.locator(selector).first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(
    ([x, y]) => {
      if (!document.getElementById('promo-touch-style')) {
        const s = document.createElement('style');
        s.id = 'promo-touch-style';
        s.textContent = `
          .promo-touch { position: fixed; z-index: 2147483647; width: 46px; height: 46px; margin: -23px 0 0 -23px;
            border-radius: 50%; background: rgba(40, 40, 40, 0.28); border: 2px solid rgba(255,255,255,0.7);
            pointer-events: none; animation: promo-touch 520ms ease-out forwards; }
          @keyframes promo-touch { 0% { transform: scale(1.25); opacity: 0; } 18% { transform: scale(0.85); opacity: 1; }
            55% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }`;
        document.head.append(s);
      }
      const d = document.createElement('div');
      d.className = 'promo-touch';
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      document.body.append(d);
    },
    [x, y],
  );
  await wait(0.12);
  return { x, y };
}
async function tap(selector) {
  mark(`tap ${selector}`);
  await touch(selector);
  await page.locator(selector).first().click({ force: true, noWaitAfter: true });
  await wait(0.2);
}
async function type(selector, text, cps = 22) {
  await page.locator(selector).focus();
  for (const ch of text) {
    mark('key');
    await page.keyboard.type(ch);
    await wait(1 / cps);
  }
}

/* ── Clips ───────────────────────────────────────────────────────── */

const want = (name) => !only || only.includes(name);

// Today opening: cards cascade in, the ring sweeps round from nothing.
// What the app looks like installed on an iPhone. It asks for a translucent
// status bar and pads itself with env(safe-area-inset-*), which a desktop
// browser reports as zero; this puts the iPhone's insets in their place and
// draws the status bar and home indicator over the top.
async function iphone() {
  await page.evaluate(() => {
    const INSETS = { top: '54px', bottom: '28px' };
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const walk = (list) => {
        for (const r of list) {
          if (r.cssRules) walk(r.cssRules);
          if (!r.style) continue;
          for (const prop of [...r.style]) {
            const v = r.style.getPropertyValue(prop);
            if (v.includes('safe-area-inset')) {
              r.style.setProperty(
                prop,
                v.replace(/env\(safe-area-inset-(top|bottom)[^)]*\)/g, (_, side) => INSETS[side]).replace(/env\(safe-area-inset-(left|right)[^)]*\)/g, '0px'),
                r.style.getPropertyPriority(prop),
              );
            }
          }
        }
      };
      walk(rules);
    }
    const bar = document.createElement('div');
    bar.id = 'promo-status';
    bar.innerHTML = `<span>9:41</span><span class="i">
      <svg width="19" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="17" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.5 6.9a6.4 6.4 0 0 1 9 0l-1.5 1.5a4.3 4.3 0 0 0-6 0zM1.2 4.6a9.6 9.6 0 0 1 13.6 0L13.3 6.1a7.5 7.5 0 0 0-10.6 0z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="18" height="9" rx="2"/><rect x="24.5" y="4.5" width="1.6" height="4" rx=".8" opacity=".45"/></svg></span>`;
    const home = document.createElement('div');
    home.id = 'promo-home';
    const st = document.createElement('style');
    st.textContent = `
      #promo-status { position: fixed; z-index: 2147483646; left: 0; right: 0; top: 0; height: 54px; padding: 0 30px 0 50px;
        display: flex; align-items: center; justify-content: space-between; background: #176B3A; color: #fff;
        font: 600 17px/1 -apple-system, Inter, sans-serif; letter-spacing: -0.01em; pointer-events: none; }
      #promo-status .i { display: flex; gap: 6px; align-items: center; }
      #promo-status svg { fill: currentColor; }
      #promo-home { position: fixed; z-index: 2147483646; left: 50%; bottom: 8px; width: 139px; height: 5px; margin-left: -70px;
        border-radius: 3px; background: #111; pointer-events: none; }`;
    document.head.append(st);
    document.body.append(bar, home);
  });
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.styleSheets.length > 0 && document.body);
await iphone();
if (want('today')) clip('today');
else dir = null;
await wait(3.0);

// Typing dinner in, the estimate, the sheet, and the ring moving on.
if (want('log')) clip('log');
else dir = null;
await tap('#text');
await type('#text', 'salmon, new potatoes and green beans');
await wait(0.35);
// The model takes a moment in real life; so it does here.
const releaseEstimate = await hold('**/api/entries/preview');
await tap('#submit-btn');
await wait(0.8);
releaseEstimate();
mark('estimate');
await wait(1.9);
const releaseToday = await hold('**/api/stats/today**');
await tap('#confirm-save');
await wait(0.5);
releaseToday();
mark('ring');
await wait(1.3);
// Down to the diary, where the dinner now sits.
await scrollTo(['#today-entries-section', 70], 1.0);
await wait(1.2);

// The week: the diary loading in, then a scroll down through it.
dir = null;
await scrollTo(0, 0.1, false);
await wait(3.5, false); // the "saved" toast leaves before the next shot
if (want('diary')) clip('diary');
else dir = null;
const releaseWeek = await hold('**/api/match-weeks/current**');
await tap('#tab-bar [data-nav="week"]');
await wait(0.15);
releaseWeek();
mark('loaded');
await wait(1.1);
await scrollTo(['#copy-day-toggle', 90], 2.2);
await wait(0.6);

// Weight: the trend chart drawing itself.
if (want('stats')) clip('stats');
else dir = null;
const releaseWeights = await hold('**/api/weigh-ins**');
await tap('#tab-bar [data-nav="stats"]');
await wait(0.15);
releaseWeights();
mark('loaded');
await wait(1.2);
await scrollTo(['#weighin-chart-card', 110], 0.9);
await wait(1.6);

// The target moving to what the weight says the burn really is.
if (want('target')) clip('target');
else dir = null;
await tap('#tab-bar [data-nav="today"]');
await wait(0.8);
await scrollTo(['#target-review-card', 120], 1.0);
await wait(1.4);
const releaseRing = await hold('**/api/stats/today**');
await tap('#target-review-accept');
await wait(0.5);
await scrollTo(0, 0.8);
releaseRing();
mark('ring');
await wait(1.8);

await browser.close();
if (!only) writeFileSync(join(here, 'clips', 'markers.json'), JSON.stringify(markers, null, 1));
console.log('done');
