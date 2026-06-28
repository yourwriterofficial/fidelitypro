import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';

/**
 * Determines whether an account is "restricted" because it never invested
 * within the allowed inactivity window.
 *
 * Policy: such users are NOT logged out. Instead their view is limited to the
 * Wallet page so they can top up — which lifts the restriction. Access is also
 * lifted once they have an investment.
 *
 * An account is restricted when ALL of the following are true:
 *   - it is not an admin account
 *   - the inactivity grace window (settings.inactivity_hours) has elapsed since
 *     the account was created
 *   - it has no investment (no orders)
 *   - it has no funds (wallet_balance <= 0)
 */
export function useAccountRestriction() {
  const { user, profile } = useAuthStore();
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const check = async () => {
      // Admins are never restricted.
      if (profile.is_admin) {
        if (!cancelled) { setRestricted(false); setLoading(false); }
        return;
      }

      // Topping up (wallet_balance > 0) regains full access immediately.
      if ((profile.wallet_balance || 0) > 0) {
        if (!cancelled) { setRestricted(false); setLoading(false); }
        return;
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inactivity_hours')
        .single();
      const graceHours = settings ? parseInt(settings.value) || 24 : 24;

      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profile.id)
        .limit(1);
      const hasInvestment = !!(orders && orders.length > 0);

      const ageMs = Date.now() - new Date(profile.created_at).getTime();
      const expired = ageMs > graceHours * 60 * 60 * 1000;

      if (!cancelled) {
        setRestricted(expired && !hasInvestment);
        setLoading(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user, profile]);

  return { restricted, loading };
}
