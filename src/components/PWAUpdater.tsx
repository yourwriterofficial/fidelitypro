import { useEffect } from 'react';

export default function PWAUpdater() {
  useEffect(() => {
    // 1. Vite chunk loading failure recovery (e.g. after a new build has new asset hashes)
    const handlePreloadError = (event: Event) => {
      console.warn('Dynamic asset preload failed, refreshing to latest deployment...', event);
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('vite:preloadError', handlePreloadError);
      };
    }

    let reloading = false;
    // When the new worker takes control, seamlessly reload the page into the new deploy
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // If a new worker is already waiting, tell it to take over immediately
      if (registration.waiting) {
        activateWaitingWorker(registration);
      }

      // If a new worker is installing, activate it as soon as installed
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            activateWaitingWorker(registration);
          }
        });
      });

      // Periodically check for updates (every 2 minutes) & when tab regains focus
      const checkUpdate = () => {
        registration.update().catch(() => {});
      };

      const intervalId = setInterval(checkUpdate, 2 * 60 * 1000);

      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });

    return () => {
      window.removeEventListener('vite:preloadError', handlePreloadError);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
