import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';

export function useInactivityTimer() {
  const { user, profile } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasInvestment, setHasInvestment] = useState(false);
  const [gracePeriodHours, setGracePeriodHours] = useState(24);
  // `ready` gates the countdown until we have actually checked whether the user
  // has an investment. Without this, the very first interval tick fired with the
  // default `hasInvestment === false` BEFORE the orders lookup resolved, so any
  // user whose account is older than the grace period (including active
  // investors) was instantly signed out with the "Inactivity period expired"
  // error on login. See the second effect — it never runs until the check lands.
  const [ready, setReady] = useState(false);

  // 1. Load settings + investment status. Only when this resolves do we allow
  //    the countdown/expiry logic to run.
  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    setReady(false);

    const fetchSettingsAndCheck = async () => {
      // Inactivity grace window (hours) from settings
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inactivity_hours')
        .single();
      if (!cancelled && data) setGracePeriodHours(parseInt(data.value) || 24);

      // Does the user have any order/investment? (any status)
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profile.id)
        .limit(1);

      if (cancelled) return;
      setHasInvestment(!!(orders && orders.length > 0));
      setReady(true);
    };

    fetchSettingsAndCheck();
    return () => { cancelled = true; };
  }, [user, profile]);

  // 2. Run the countdown only once the investment check has completed.
  useEffect(() => {
    if (!user || !profile || !ready) return;

    // Active investors are never subject to the inactivity timer.
    if (hasInvestment) {
      setTimeLeft(null);
      return;
    }

    const tick = () => {
      const createdAt = new Date(profile.created_at);
      const graceMs = gracePeriodHours * 60 * 60 * 1000;
      const remaining = graceMs - (Date.now() - createdAt.getTime());
      // Expiry no longer logs the user out. We simply stop the countdown at 0;
      // once expired, useAccountRestriction() limits the account to the Wallet
      // page until the user tops up. See useAccountRestriction.ts.
      setTimeLeft(remaining <= 0 ? 0 : Math.floor(remaining / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [user, profile, ready, hasInvestment, gracePeriodHours]);

  return { timeLeft, hasInvestment };
}
