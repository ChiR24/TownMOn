// Service worker for the gate tablet (scope /gate). Keeps the gate screen loading when the network drops:
// the page is fetched network-first and cached; Next's hashed static files are cached on first use.
// Gate API calls are never cached here: the app queues entries in IndexedDB and replays them itself.
const CACHE = "gate-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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

  if (request.mode === "navigate" && url.pathname.startsWith("/gate")) {
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
