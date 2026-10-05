/* =========================================================================
   THICKET: sw.js (offline memory)
   v3: full style rewrite. Raise the number whenever any app file changes.
   ========================================================================= */
const CACHE_NAME = "thicket-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./thicket.css",
  "./thicket-styles.js",
  "./thicket-app.js",
  "./manifest.webmanifest",
  "./icon/icon-192.png",
  "./icon/icon-512.png",
  "./icon/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_FILES.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fromNet = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fromNet;
    })
  );
});
