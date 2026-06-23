import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useInactivityTimer() {
  const { user, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasInvestment, setHasInvestment] = useState(false);
  const [gracePeriodHours, setGracePeriodHours] = useState(24);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchSettingsAndCheck = async () => {
      // Get inactivity hours from settings
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inactivity_hours')
        .single();
      if (data) setGracePeriodHours(parseInt(data.value) || 24);

      // Check if user has any order (any status)
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profile.id)
        .limit(1);
      setHasInvestment(orders && orders.length > 0);
    };

    fetchSettingsAndCheck();

    const interval = setInterval(() => {
      if (!profile) return;
      if (hasInvestment) {
        setTimeLeft(null);
        return;
      }
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const graceMs = gracePeriodHours * 60 * 60 * 1000;
      const remaining = graceMs - diffMs;
      if (remaining <= 0) {
        // Time's up – logout
        signOut();
        navigate('/login');
        toast.error('Inactivity period expired – please invest within the allowed time.');
        setTimeLeft(0);
      } else {
        setTimeLeft(Math.floor(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, profile, hasInvestment, signOut, navigate, gracePeriodHours]);

  return { timeLeft, hasInvestment };
}