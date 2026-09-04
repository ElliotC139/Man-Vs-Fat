/**
 * Offline shell for the food diary.
 *
 * Two caching strategies, chosen by what breaks if the answer is stale:
 *
 *   Static shell (HTML/CSS/JS/icons) — cache-first. It only changes on a
 *   deploy, and serving it instantly is what makes the app open at all with
 *   no signal.
 *
 *   API reads — network-first, falling back to the last successful response.
 *   A diary that shows this morning's entries offline is useful; one that
 *   shows yesterday's while online would be a bug.
 *
 * Writes are deliberately NOT queued here. Background Sync is Chrome-only,
 * and this app has to work on iPhones — the queue lives in the page instead
 * (see the offline queue in app.js), backed by IndexedDB and flushed on
 * reconnect, which works everywhere.
 */

// Bumped on every deploy that changes a shell file, so old caches are dropped.
const VERSION = "v17";
const SHELL_CACHE = `shell-${VERSION}`;
const API_CACHE = `api-${VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "/manifest.webmanifest",
  "/icons/mark.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/404.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll fails the whole install if any single file 404s, which would
      // leave the app with no worker at all — so each is added on its own.
      .then((cache) => Promise.all(SHELL_ASSETS.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== API_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only this origin: Open Food Facts and the fonts CDN are none of the
  // worker's business, and caching a failed cross-origin response would be
  // worse than letting it fail.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // An uploaded photo never changes once written, so it's cached with the
  // shell rather than revalidated.
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    // A 401 means the session lapsed, not that the data is good — caching it
    // would leave the app permanently "logged out" offline.
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "You're offline and this hasn't been loaded before." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Refresh in the background so the next load has the new deploy, without
    // making this one wait for the network.
    fetchAndCache(request).catch(() => {});
    return cached;
  }
  try {
    return await fetchAndCache(request);
  } catch {
    // A navigation with nothing cached still deserves the app shell rather
    // than the browser's offline dinosaur.
    if (request.mode === "navigate") {
      const shell = await caches.match("/index.html");
      if (shell) return shell;
    }
    throw new Error("Offline and not cached");
  }
}

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// ── Push ───────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Match Week Food Diary";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces an earlier unread reminder rather than stacking a
      // second copy of the same nag.
      tag: payload.tag || "diary",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus the app if it's already open rather than opening a second tab.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
