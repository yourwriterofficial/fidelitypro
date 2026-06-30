import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';

/**
 * Determines whether an account is "restricted" because it never invested
 * within the allowed inactivity window.
 *
 * Policy: such users are NOT logged out. Instead their access is limited or certain
 * actions are suspended depending on the admin settings.
 */
export function useAccountRestriction() {
  const { user, profile } = useAuthStore();
  const [restricted, setRestricted] = useState(false); // isWalletOnly
  const [withdrawRestricted, setWithdrawRestricted] = useState(false);
  const [investRestricted, setInvestRestricted] = useState(false);
  const [stakeRestricted, setStakeRestricted] = useState(false);
  const [propertyRestricted, setPropertyRestricted] = useState(false);
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
        if (!cancelled) {
          setRestricted(false);
          setWithdrawRestricted(false);
          setInvestRestricted(false);
          setStakeRestricted(false);
          setPropertyRestricted(false);
          setLoading(false);
        }
        return;
      }

      // Check if they have an active investment (orders check)
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profile.id)
        .limit(1);
      const hasInvestment = !!(orders && orders.length > 0);
      const hasBalance = (profile.wallet_balance || 0) > 0;

      // Topping up or already having investments lifts restrictions immediately.
      if (hasInvestment || hasBalance) {
        if (!cancelled) {
          setRestricted(false);
          setWithdrawRestricted(false);
          setInvestRestricted(false);
          setStakeRestricted(false);
          setPropertyRestricted(false);
          setLoading(false);
        }
        return;
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inactivity_hours')
        .single();
      const graceHours = settings ? parseInt(settings.value) || 24 : 24;

      const { data: restrictionSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inactivity_restriction_type')
        .single();
      const restrictionType = restrictionSetting?.value || 'wallet_only';

      const ageMs = Date.now() - new Date(profile.created_at).getTime();
      const expired = ageMs > graceHours * 60 * 60 * 1000;

      if (!cancelled) {
        if (expired) {
          setRestricted(restrictionType === 'wallet_only');
          setWithdrawRestricted(restrictionType === 'suspend_withdraw' || restrictionType === 'suspend_all');
          setInvestRestricted(restrictionType === 'suspend_invest' || restrictionType === 'suspend_all');
          setStakeRestricted(restrictionType === 'suspend_invest' || restrictionType === 'suspend_all');
          setPropertyRestricted(restrictionType === 'suspend_invest' || restrictionType === 'suspend_all');
        } else {
          setRestricted(false);
          setWithdrawRestricted(false);
          setInvestRestricted(false);
          setStakeRestricted(false);
          setPropertyRestricted(false);
        }
        setLoading(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user, profile]);

  return {
    restricted, // Wallet only redirect flag
    withdrawRestricted,
    investRestricted,
    stakeRestricted,
    propertyRestricted,
    loading
  };
}
