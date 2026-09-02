/*
 * Messaging Service Worker für Taste It's Tasty.
 * Ausschließlich Web Push + Notification-Klick. Kein Offline-/App-Shell-Caching,
 * damit keine Auth-, Realtime- oder Checkout-Antworten zwischengespeichert werden.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Neue Bestellung eingegangen";
  const body = payload.body || "Im Adminbereich ansehen.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "new-order",
      renotify: true,
      requireInteraction: false,
      data: { url: "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.pathname.startsWith("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })(),
  );
});
