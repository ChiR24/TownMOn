// Service worker for the gate tablet (scope /gate). Keeps the gate screen loading when the network drops:
// the page is fetched network-first and cached; Next's hashed static files are cached on first use.
// Gate API calls are never cached here: the app queues entries in IndexedDB and replays them itself.
const CACHE = "gate-v1";

// Caches the gate screen and the static files it names. A guard reaches /gate by a client-side hop from /login, which
// this worker never sees, so without this a reload with no network straight after signing in would show the browser's
// offline page. Runs when the worker installs, and when the gate screen opens with nothing cached (signing out
// deletes the cache, so the next guard's sign-in fills it again).
const precache = () =>
  fetch("/gate")
    .then(async (res) => {
      if (!res.ok || res.redirected) return;
      const cache = await caches.open(CACHE);
      const files = new Set((await res.clone().text()).match(/\/_next\/static\/[^"'\\\s<>]+/g));
      await Promise.all([cache.put("/gate", res), ...[...files].map((f) => cache.match(f).then((hit) => hit || cache.add(f)).catch(() => {}))]);
    })
    .catch(() => {});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precache());
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data === "precache") e.waitUntil(caches.match("/gate").then((hit) => hit || precache()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // The gate screen only. Other pages in scope (the visitors' notice at /gate/notice) must not take its place.
  if (request.mode === "navigate" && url.pathname === "/gate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/gate", copy));
          }
          return res;
        })
        .catch(() => caches.match("/gate")),
    );
  }
});
