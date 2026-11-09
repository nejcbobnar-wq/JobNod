/* JobNod service worker: keeps the app working offline after the first visit */
const CACHE = "jobnod-v125";
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

/* push alerts from the server (v121): shown even when the app is closed; skipped while the app is open on screen */
function jnPush(d) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    cs.forEach(c => c.postMessage({ type: "jn-push", d }));
    // iPhone/iPad/Mac Safari cancel push for apps that receive an alert without showing it, so there it is always shown
    const apple = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent);
    if (!apple && cs.some(c => c.visibilityState === "visible" && c.focused)) return;
    return self.registration.showNotification(d.title || "JobNod", { body: d.body || "", icon: "./icon-192.png", tag: d.tag || "jn", renotify: true, data: { url: d.url || "./" } });
  });
}
self.addEventListener("push", e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; } e.waitUntil(jnPush(d)); });

/* tapping an alert opens the app (and the right conversation); if the open app can't be woken up, it opens fresh at that place */
async function jnOpen(url, tag) {
  const target = url ? new URL(url, self.registration.scope).href : new URL("./?note=" + encodeURIComponent(tag || ""), self.registration.scope).href;
  const msg = url ? { type: "jn-open", url: target } : { type: "jn-note", tag };
  const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of cs) {
    try {
      const w = (await c.focus()) || c;
      w.postMessage(msg);
      await new Promise(r => setTimeout(r, 700));
      try { w.postMessage(msg); } catch (_) {}
      return "focused";
    } catch (_) {}
  }
  await self.clients.openWindow(target);
  return "opened";
}
self.addEventListener("notificationclick", e => {
  const url = e.notification.data && e.notification.data.url, tag = e.notification.tag || ""; e.notification.close();
  e.waitUntil(jnOpen(url, tag));
});
