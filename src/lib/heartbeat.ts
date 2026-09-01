import { supabase } from './supabaseClient';

const HEARTBEAT_KEY = 'rpm_last_heartbeat';
const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * Sends an ultra-lightweight ping (1 row select) to keep Supabase active
 * Throttled to at most once every 6 hours per device.
 */
export async function triggerPassiveHeartbeat(): Promise<void> {
  try {
    const last = localStorage.getItem(HEARTBEAT_KEY);
    const now = Date.now();
    if (last && now - Number(last) < SIX_HOURS) {
      return;
    }

    localStorage.setItem(HEARTBEAT_KEY, String(now));
    await supabase.from('settings').select('key').limit(1);
  } catch {
    // Fail silently — passive background operation
  }
}
