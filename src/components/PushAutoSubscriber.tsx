import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Invisible component that auto-subscribes the logged-in user to push
 * notifications. Drop it into the root layout so every authenticated
 * session gets push enabled by default.
 */
export default function PushAutoSubscriber() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  // The hook itself handles auto-subscribe via its internal useEffect
  usePushNotifications(userId);

  return null; // Renders nothing
}
