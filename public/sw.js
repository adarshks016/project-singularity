/* Offline shell for the timer.

   Hashed build assets are content-addressed, so they are safe to serve
   cache-first and keep forever. The HTML document is not: it names the current
   bundles, so serving a cached copy first pins the app to whatever version was
   installed and no later deploy can ever be picked up. HTML therefore goes to
   the network first and falls back to the cache only when offline. */
const CACHE = "singularity-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/index.html"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHTML(req) {
  return req.mode === "navigate" ||
         (req.headers.get("accept") || "").includes("text/html");
}

/* Only successful, non-partial, basic responses belong in the cache — storing an
   error means a single failed request is served from disk from then on. */
function keep(req, res) {
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never touch third-party embeds, fonts or thumbnails.
  if (url.origin !== location.origin || e.request.method !== "GET") return;

  if (isHTML(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => keep(e.request, res))
        .catch(() =>
          caches.match(e.request).then((hit) => hit || caches.match("/index.html"))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (hit) => hit || fetch(e.request).then((res) => keep(e.request, res))
    )
  );
});
