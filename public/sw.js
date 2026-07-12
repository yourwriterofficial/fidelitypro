// RPM Service Worker — handles Web Push notifications and notification clicks.
const APP_ORIGIN = self.location.origin;

// A new worker stays in the "waiting" state (does NOT skipWaiting on install)
// so PWAUpdater.tsx can prompt the user before switching them to it — it only
// activates once the client posts SKIP_WAITING (user clicked "Refresh"), or
// immediately for a first-ever install (no existing controller to disrupt).
self.addEventListener('install', () => {
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// This worker never writes to Cache Storage itself, but on every activation
// (i.e. every new deploy) we sweep any cache entries left behind by a past
// version anyway — belt-and-braces so a stale cached response can never be
// served after an update. This never touches localStorage/IndexedDB, so the
// logged-in Supabase session is untouched.
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
    badge: '/icons/icon-192x192.png',
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
