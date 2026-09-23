// Injected before any of the app's own scripts. Replaces the page's sense of
// time with one the capture script steps by hand, so an animation that takes
// 450ms in real life takes exactly 27 frames at 60fps however slowly the
// screenshots come back.
//
// Covered: performance.now, Date, setTimeout/setInterval, requestAnimationFrame
// (the ring is driven by those) and CSS animations/transitions, which are
// paused and have their currentTime set from the virtual clock (the cards,
// diary rows, sheets and chart points are those).
(() => {
  let now = 0;
  const epoch = Date.now();
  const RealDate = Date;

  class VDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(epoch + now);
      else super(...a);
    }
    static now() {
      return epoch + now;
    }
  }
  window.Date = VDate;
  performance.now = () => now;

  const timers = new Map();
  let nextTimer = 1;
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextTimer++;
    timers.set(id, { fn, at: now + Math.max(0, Number(ms) || 0), args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const every = Math.max(1, Number(ms) || 0);
    const id = nextTimer++;
    timers.set(id, { fn, at: now + every, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);

  let rafs = new Map();
  let nextRaf = 1;
  window.requestAnimationFrame = (fn) => {
    const id = nextRaf++;
    rafs.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => rafs.delete(id);

  // Each CSS animation's start, on the virtual clock, first time it's seen.
  const started = new WeakMap();
  function syncAnimations() {
    for (const a of document.getAnimations()) {
      if (!started.has(a)) {
        started.set(a, now);
        a.pause();
      }
      a.currentTime = now - started.get(a);
    }
  }

  const run = (fn, args) => {
    try {
      typeof fn === 'function' ? fn(...args) : (0, eval)(fn);
    } catch (e) {
      console.error(e);
    }
  };

  window.__clock = {
    get now() {
      return now;
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let due = null;
        for (const [id, t] of timers) if (t.at <= target && (!due || t.at < due[1].at)) due = [id, t];
        if (!due) break;
        const [id, t] = due;
        now = Math.max(now, t.at);
        if (t.every) t.at += t.every;
        else timers.delete(id);
        run(t.fn, t.args);
      }
      now = target;
      const frame = rafs;
      rafs = new Map();
      for (const fn of frame.values()) run(fn, [now]);
      syncAnimations();
    },
    sync: syncAnimations,
  };
})();
