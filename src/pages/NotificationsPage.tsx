import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { BellOff, Check, CheckCheck, X, Calendar, ArrowRight, ShieldAlert, ShieldCheck, Info } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
  link?: string;
  created_at: string;
}

const TYPE_STYLES = {
  success: { border: 'border-emerald-100 bg-emerald-50/30 text-emerald-800', icon: ShieldCheck, iconBg: 'bg-emerald-100 text-emerald-600' },
  warning: { border: 'border-amber-100 bg-amber-50/30 text-amber-800',     icon: ShieldAlert, iconBg: 'bg-amber-100 text-amber-600' },
  alert:   { border: 'border-red-100 bg-red-50/30 text-red-800',         icon: ShieldAlert, iconBg: 'bg-red-100 text-red-650' },
  info:    { border: 'border-blue-100 bg-blue-50/30 text-blue-800',       icon: Info,        iconBg: 'bg-blue-100 text-blue-600' },
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'staking' | 'wallet' | 'security'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user?.id, filter, page]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('read', false);
      } else if (filter === 'staking') {
        query = query.ilike('link', '%staking%');
      } else if (filter === 'wallet') {
        query = query.or('link.ilike.%wallet%,title.ilike.%deposit%,title.ilike.%withdrawal%');
      } else if (filter === 'security') {
        query = query.or('type.eq.warning,type.eq.alert,title.ilike.%security%,title.ilike.%password%');
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setNotifications(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err: any) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    if (unread.length === 0) return;
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).in('id', unread);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch (err: any) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
      toast.success('Notification deleted');
    } catch (err: any) {
      toast.error('Failed to delete notification');
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Notification Center</h1>
          <p className="text-gray-500 text-sm mt-1">Review activity reports, system notices, and transactions.</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shrink-0 flex items-center gap-2 text-sm text-gray-600 font-semibold"
          >
            <CheckCheck size={15} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-1">
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'unread', label: 'Unread' },
          { id: 'staking', label: 'Staking' },
          { id: 'wallet', label: 'Wallet & Funds' },
          { id: 'security', label: 'Security' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setFilter(tab.id as any); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
              filter === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <BellOff size={32} className="text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-800">Clear Skies!</h3>
            <p className="text-sm text-gray-450 mt-1">No notifications matching the filter were found.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const styles = TYPE_STYLES[n.type] || TYPE_STYLES.info;
            const Icon = styles.icon;
            return (
              <div
                key={n.id}
                className={`relative border rounded-2xl p-4 flex items-start gap-3.5 transition bg-white shadow-sm ${
                  !n.read ? 'border-brand/35 bg-brand/5' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {/* Icon box */}
                <div className={`p-2.5 rounded-xl shrink-0 ${styles.iconBg}`}>
                  <Icon size={18} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <p className={`text-sm font-bold truncate ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="text-[8px] bg-red-100 text-red-600 font-bold px-1 rounded uppercase tracking-wider">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(n.created_at).toLocaleString()}</span>
                    {n.link && (
                      <a href={n.link} className="text-brand font-semibold hover:underline flex items-center gap-0.5">
                        Verify <ArrowRight size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Operations */}
                <div className="flex items-center gap-1 shrink-0 self-center">
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-450 hover:text-emerald-600 transition"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-450 hover:text-red-500 transition"
                    title="Delete notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-xs text-gray-500">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold border rounded-xl bg-white hover:bg-gray-50 transition disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-semibold border rounded-xl bg-white hover:bg-gray-50 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
