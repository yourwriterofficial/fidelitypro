import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { Bell, BellOff, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
  link?: string;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevUnreadCount = useRef(0);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error(error);
      return;
    }
    const newUnread = data?.filter((n) => !n.read).length || 0;
    // Show toast only if new unread count increased
    if (newUnread > prevUnreadCount.current) {
      const newNotifs = data?.filter((n) => !n.read && n.created_at > new Date(Date.now() - 30 * 1000).toISOString());
      if (newNotifs?.length) {
        toast.info(`📬 ${newNotifs.length} new notification${newNotifs.length > 1 ? 's' : ''}`);
      }
    }
    prevUnreadCount.current = newUnread;
    setNotifications(data || []);
    setUnreadCount(newUnread);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // Poll every 15 seconds
    intervalRef.current = setInterval(fetchNotifications, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) toast.error('Failed to mark as read');
    else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      prevUnreadCount.current = Math.max(0, prevUnreadCount.current - 1);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
    if (error) toast.error('Failed to mark all as read');
    else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      prevUnreadCount.current = 0;
      toast.success('All notifications marked as read');
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="w-8 h-8 animate-pulse bg-gray-200 rounded-full" />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <>
            <Bell size={20} className="text-brand" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <BellOff size={20} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-brand hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No notifications</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <div key={n.id} className={`p-3 hover:bg-gray-50 transition ${!n.read ? 'bg-blue-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <button onClick={() => markAsRead(n.id)} className="ml-2 text-gray-400 hover:text-gray-600">
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  {n.link && (
                    <a href={n.link} className="text-xs text-brand hover:underline mt-1 inline-block">
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}