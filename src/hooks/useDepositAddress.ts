import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';

export function useDepositAddress() {
  const { user } = useAuthStore();
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string>('BEP20');
  const [currency, setCurrency] = useState<string>('USDT');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchAddress = async () => {
      // FIX: changed .single() to .maybeSingle() — .single() throws error code
      // PGRST116 when no row exists (e.g. address not yet assigned to this user),
      // crashing the hook. .maybeSingle() returns null cleanly instead.
      const { data, error } = await supabase
        .from('user_deposit_addresses')
        .select('address, network, currency')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch deposit address:', error);
        setLoading(false);
        return;
      }
      if (data) {
        setAddress(data.address);
        setNetwork(data.network);
        setCurrency(data.currency);
      }
      setLoading(false);
    };
    fetchAddress();
  }, [user]);

  return { address, network, currency, loading };
}
