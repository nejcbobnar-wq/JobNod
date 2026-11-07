/* JobNod service worker: keeps the app working offline after the first visit */
const CACHE = "jobnod-v90";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon-32.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // app files: network first so updates arrive, cache as fallback offline
    const net = req.mode === "navigate" ? fetch(url.href, { cache: "no-cache" }) : fetch(req, { cache: "no-cache" });
    e.respondWith(net.then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
  } else if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })));
  }
});

/* tapping an alert opens the app */
self.addEventListener("notificationclick", e => { const tag = e.notification.tag || ""; e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) { if ("focus" in c) { c.postMessage({ type: "jn-note", tag }); return c.focus(); } } return self.clients.openWindow("./?note=" + encodeURIComponent(tag)); })); });
