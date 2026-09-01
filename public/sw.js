// RPM Service Worker — handles Web Push notifications and notification clicks.
const APP_ORIGIN = self.location.origin;

// Auto skip waiting immediately upon install so new deployments activate automatically
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate immediately and claim all client tabs without disruption
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ── Push: server-sent notification ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title = data.title || 'RPM';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: data.tag || 'rpm-notify',
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/app' },
    actions: data.url ? [{ action: 'open', title: 'View' }] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch((err) => {
        console.warn('[SW] showNotification failed, retrying with basic options:', err);
        return self.registration.showNotification(title, {
          body: options.body,
          icon: options.icon,
          data: options.data,
        });
      })
  );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/app', APP_ORIGIN).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(APP_ORIGIN) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
