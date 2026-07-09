import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { Bell, BellOff, Check, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string; title: string; message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean; link?: string; created_at: string;
}

const TYPE_STYLES: Record<string, { dot: string; bg: string }> = {
  success: { dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
  warning: { dot: 'bg-amber-500',   bg: 'bg-amber-50'   },
  alert:   { dot: 'bg-red-500',     bg: 'bg-red-50'     },
  info:    { dot: 'bg-blue-500',    bg: 'bg-blue-50'    },
};

const formatTime = (date: string) => {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const intervalRef = useRef<number | null>(null);
  const prevUnreadCount = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (error) { console.error(error); return; }
    const newUnread = data?.filter(n => !n.read).length || 0;
    if (newUnread > prevUnreadCount.current) {
      const newNotifs = data?.filter(n => !n.read && n.created_at > new Date(Date.now() - 30000).toISOString());
      if (newNotifs?.length) toast.info(`${newNotifs.length} new notification${newNotifs.length > 1 ? 's' : ''}`);
    }
    prevUnreadCount.current = newUnread;
    setNotifications(data || []);
    setUnreadCount(newUnread);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  // Calculate dropdown position so it never goes off-screen
  const calcPos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropW = 320; // w-80
    const gap = 8;
    const top = rect.bottom + gap;
    // Align right edge with button right, but clamp to viewport
    const left = Math.max(8, Math.min(rect.right - dropW, window.innerWidth - dropW - 8));
    setDropdownPos({ top, left });
  }, []);

  const handleToggle = () => {
    if (!open) calcPos();
    setOpen(prev => !prev);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) toast.error('Failed to mark as read');
    else {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      prevUnreadCount.current = Math.max(0, prevUnreadCount.current - 1);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    if (error) toast.error('Failed to mark all as read');
    else {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0); prevUnreadCount.current = 0;
      toast.success('All notifications marked as read');
    }
  };

  if (loading) return <div className="w-8 h-8 animate-pulse bg-gray-100 rounded-xl" />;

  return (
    <div className="relative">
      {/* Bell button */}
      <button ref={buttonRef} onClick={handleToggle} aria-label="Notifications"
        className={`relative p-2 rounded-xl transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-100'}`}>
        {unreadCount > 0 ? (
          <>
            <Bell size={19} className="text-brand" />
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <BellOff size={19} className="text-gray-400" />
        )}
      </button>

      {/* Dropdown — fixed so it's never clipped by sidebar or off-screen */}
      {open && (
        <div ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: 320 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60 sticky top-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} title="Mark all as read"
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-brand">
                  <CheckCheck size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <BellOff size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
                return (
                  <div key={n.id} className={`group px-4 py-3 transition-colors ${!n.read ? style.bg : 'hover:bg-gray-50/70'}`}>
                    <div className="flex items-start gap-2.5">
                      {/* Type dot */}
                      <div className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-gray-400">{formatTime(n.created_at)}</span>
                          {n.link && (
                            <a href={n.link} className="text-[10px] text-brand hover:underline font-medium">View →</a>
                          )}
                        </div>
                      </div>
                      {!n.read && (
                        <button onClick={() => markAsRead(n.id)} title="Mark as read"
                          className="p-1 hover:bg-white rounded-lg transition text-gray-300 hover:text-emerald-500 shrink-0 opacity-0 group-hover:opacity-100">
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-1.5 text-center">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-brand hover:underline font-semibold">
                Mark all as read
              </button>
            )}
            <Link to="/app/notifications" onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold uppercase tracking-wider block">
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
