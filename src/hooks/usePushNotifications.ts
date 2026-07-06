// Full Web Push (VAPID) — works when the tab is closed, on PWA home screen,
// and in the phone's system notification panel like a native app.
import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

let _vapidKeyPromise: Promise<string> | null = null;

async function resolveVapidPublicKey(): Promise<string> {
  const localKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (localKey && localKey.length === 87) {
    return localKey;
  }
  if (!_vapidKeyPromise) {
    _vapidKeyPromise = (async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/vapid-key`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        if (!res.ok) throw new Error('Failed to fetch VAPID key');
        const { publicKey } = await res.json() as { publicKey: string };
        if (!publicKey || publicKey.length !== 87) {
          throw new Error('Invalid VAPID key from server');
        }
        return publicKey;
      } catch (err) {
        console.warn('[Push] failed to resolve dynamic VAPID key, using hardcoded fallback:', err);
        return "BA8RM3ej0pbVl5vx_DBKyv7GECKHji3F6oCCbzUjola1Uf0tLuh8nuDqwURDkJ_cgK8zhhNM-kq_-pAkLYtS3Y4";
      }
    })();
    _vapidKeyPromise.catch(() => { _vapidKeyPromise = null; });
  }
  return _vapidKeyPromise;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map(c => c.charCodeAt(0)));
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  const keys = json.keys as { p256dh: string; auth: string };
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: 'user_id,endpoint' });
}

async function removeSubscription(userId: string, endpoint: string) {
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

function pushErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('applicationServerKey') || msg.includes('InvalidAccessError'))
    return 'VAPID key error — please contact support';
  if (msg.includes('NotSupportedError') || msg.includes('not supported'))
    return 'Your browser does not support push notifications';
  if (msg.includes('AbortError'))
    return 'Browser blocked the subscription — try reloading the page';
  if (msg.includes('NetworkError') || msg.includes('network'))
    return 'Network error — check your connection and try again';
  if (msg.includes('permission'))
    return 'Permission denied — allow notifications in browser settings';
  return msg.length < 120 ? msg : 'Subscription failed — try again';
}

export function usePushNotifications(userId: string | undefined) {
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    getSwRegistration().then(reg => {
      swRegRef.current = reg;
      if (reg && userId) {
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
      }
    });
  }, [userId]);

  // Auto-subscribe: attempt to enable push notifications automatically
  // when the user loads any page, as long as permission is not 'denied'.
  const autoSubAttempted = useRef(false);
  useEffect(() => {
    if (!userId || autoSubAttempted.current) return;
    if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    autoSubAttempted.current = true;

    // Small delay so service worker is ready
    const timer = setTimeout(async () => {
      try {
        const reg = swRegRef.current ?? await getSwRegistration();
        if (!reg) return;
        swRegRef.current = reg;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Already subscribed in browser, just ensure DB is synced
          await saveSubscription(userId, existing);
          setSubscribed(true);
          return;
        }

        // If permission is 'default', request it
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
          setPermission(perm);
        }
        if (perm !== 'granted') return;

        const vapidKey = await resolveVapidPublicKey();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
        });
        await saveSubscription(userId, sub);
        setSubscribed(true);
        console.log('[Push] Auto-subscribed successfully');
      } catch (err) {
        console.warn('[Push] Auto-subscribe failed (non-blocking):', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [userId]);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setLastError(null);

    if (typeof window === 'undefined' || !('Notification' in window))
      return { ok: false, error: 'Notifications not supported in this browser' };
    if (!('PushManager' in window))
      return { ok: false, error: 'Push notifications not supported in this browser' };
    if (!userId)
      return { ok: false, error: 'You must be signed in' };

    let perm = Notification.permission;
    if (perm === 'denied') {
      const msg = 'Notifications are blocked. Allow them in your browser settings and try again.';
      setLastError(msg);
      return { ok: false, error: msg };
    }
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm !== 'granted') {
      const msg = 'Notification permission was not granted';
      setLastError(msg);
      return { ok: false, error: msg };
    }

    const reg = swRegRef.current ?? await getSwRegistration();
    if (!reg) {
      const msg = 'Service worker not available — try reloading the page';
      setLastError(msg);
      return { ok: false, error: msg };
    }
    swRegRef.current = reg;

    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await saveSubscription(userId, existing);
        setSubscribed(true);
        return { ok: true };
      }

      let vapidKey: string;
      try {
        vapidKey = await resolveVapidPublicKey();
      } catch {
        const msg = 'Could not load push configuration — check your connection and try again';
        setLastError(msg);
        return { ok: false, error: msg };
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });

      await saveSubscription(userId, sub);
      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      const msg = pushErrorMessage(err);
      console.error('[Push] subscribe failed:', err);
      setLastError(msg);
      return { ok: false, error: msg };
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    const reg = swRegRef.current ?? await getSwRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removeSubscription(userId, sub.endpoint);
      await sub.unsubscribe();
      setSubscribed(false);
    }
  }, [userId]);

  return { permission, subscribed, lastError, subscribe, unsubscribe };
}
