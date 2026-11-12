// TERTORTOR service worker (user 2026-11-07): only Web Push. No fetch handler and no cache: the relay already serves
// pages from its own cache when the laptop is offline, and a stale index.html here would hide Studio updates.
// The push carries no payload (no encryption needed); the worker asks the relay for the latest notice instead.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let n = { title: "TERTORTOR", body: "Ada proses yang selesai.", url: "/" };
    try {
      const r = await fetch("/api/relay/notices", { credentials: "include", cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (j.notices?.[0]) n = j.notices[0]; }
    } catch {}
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: n.id || "tertortor",
      data: { url: n.url || "/" },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (new URL(w.url).origin === self.location.origin) { await w.focus(); return w.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
