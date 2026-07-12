import { useEffect } from 'react';
import { toast } from 'sonner';

export default function PWAUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;
    // A new worker takes control (skipWaiting + clients.claim in sw.js) right
    // after the user accepts the update toast below. This fires exactly once
    // and is the only place we reload — it does not touch localStorage/
    // IndexedDB, so the Supabase session (and thus the logged-in user) is
    // preserved across the refresh.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    const promptUpdate = (registration: ServiceWorkerRegistration) => {
      toast('A new version of RPM is available', {
        description: 'Refresh to get the latest features and fixes.',
        duration: Infinity,
        action: {
          label: 'Refresh',
          onClick: () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }),
        },
      });
    };

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Case 1: a new worker already finished installing and is waiting
      // (e.g. it updated while this tab was open in the background).
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration);
      }

      // Case 2: a new worker starts installing while this tab is open.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(registration);
          }
        });
      });

      // Re-check for a newer deploy whenever the tab regains focus — browsers
      // only auto-check on navigation, so this catches updates for users who
      // keep the app open/backgrounded (common on mobile) much sooner.
      const onVisible = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  }, []);

  return null; // This component renders nothing, just runs the logic
}
