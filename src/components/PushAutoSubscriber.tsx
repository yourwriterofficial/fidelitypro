import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Component that auto-subscribes the logged-in user to push
 * notifications once authenticated.
 */
export default function PushAutoSubscriber() {
  const { user } = useAuthStore();

  // The hook itself handles auto-subscribe via its internal useEffect when user is present
  usePushNotifications(user?.id);

  return null; // Renders nothing
}
