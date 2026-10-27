import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface TrackerProfile {
  id: string;
  name?: string;
  email?: string;
}

const THROTTLE_MS = 25000; // Throttle last_seen writes to at most once every 25 seconds
const HEARTBEAT_INTERVAL_MS = 30000; // Heartbeat interval while tab is active/visible

export function useUserActivityTracker(profile: TrackerProfile | null | undefined) {
  const location = useLocation();
  const lastWriteTimeRef = useRef<number>(0);
  const lastLoggedPathRef = useRef<string>('');

  const sendLastSeenUpdate = async (isFinal = false) => {
    if (!profile?.id) return;
    const now = Date.now();
    if (!isFinal && now - lastWriteTimeRef.current < THROTTLE_MS) {
      return;
    }
    lastWriteTimeRef.current = now;
    const nowIso = new Date(now).toISOString();

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('last_seen_updated', nowIso);
      }
      await supabase
        .from('profiles')
        .update({ last_seen: nowIso })
        .eq('id', profile.id);
    } catch (err) {
      console.warn('[ActivityTracker] Failed to update last_seen:', err);
    }
  };

  // 1. Initial touch on mount / profile change
  useEffect(() => {
    if (!profile?.id) return;
    sendLastSeenUpdate();
  }, [profile?.id]);

  // 2. Navigation listener: log user_page_visits and touch last_seen
  useEffect(() => {
    if (!profile?.id) return;

    const logRouteVisit = async () => {
      if (lastLoggedPathRef.current === location.pathname) return;
      lastLoggedPathRef.current = location.pathname;

      try {
        await supabase.from('user_page_visits').insert({
          user_id: profile.id,
          path: location.pathname,
        });
      } catch (err) {
        console.warn('[ActivityTracker] Failed to log page visit:', err);
      }

      await sendLastSeenUpdate();
    };

    logRouteVisit();
  }, [location.pathname, profile?.id]);

  // 3. User interaction listener (pointer, keyboard, touch, scroll)
  useEffect(() => {
    if (!profile?.id) return;

    const handleInteraction = () => {
      const now = Date.now();
      if (now - lastWriteTimeRef.current >= THROTTLE_MS) {
        sendLastSeenUpdate();
      }
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleInteraction, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleInteraction));
    };
  }, [profile?.id]);

  // 4. Periodic heartbeat interval while tab is visible
  useEffect(() => {
    if (!profile?.id) return;

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        sendLastSeenUpdate();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [profile?.id]);

  // 5. Visibility change & page unload: flush latest timestamp on tab hide/close
  useEffect(() => {
    if (!profile?.id) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendLastSeenUpdate(true);
      } else {
        sendLastSeenUpdate();
      }
    };

    const handlePageHide = () => {
      sendLastSeenUpdate(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [profile?.id]);

  return { touchLastSeen: () => sendLastSeenUpdate(true) };
}
