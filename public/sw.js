// RPM Service Worker — handles Web Push notifications, notification clicks, and PWA installability.
const APP_ORIGIN = self.location.origin;
const CACHE_NAME = 'rpm-shell-v1';

// Cache minimal core shell on install and skip waiting so new worker activates
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/index.html', '/favicon.svg', '/manifest.json']).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Clean up old caches on activate and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: live network first with offline shell fallback ────────────────────
// Required by Chromium for full PWA installability & beforeinstallprompt event.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // For navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('/index.html');
        return cached || Response.error();
      })
    );
    return;
  }

  // Live network first for all other requests; fallback to cache if offline
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || Response.error();
    })
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
