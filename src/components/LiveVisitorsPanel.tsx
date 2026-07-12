import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { notifyUser } from '../lib/notify';
import { Bell, BellRing, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { OnlineVisitor } from './Layout';

interface LiteUser {
  id: string;
  name: string;
  email: string;
}

type OnlineUser = OnlineVisitor;

const getPageLabel = (path: string) => {
  if (path === '/app') return 'Dashboard';
  if (path.startsWith('/app/wallet')) return 'Wallet';
  if (path.startsWith('/app/staking')) return 'Staking';
  if (path.startsWith('/app/invest')) return 'Invest';
  if (path.startsWith('/app/my-portfolio')) return 'Portfolio';
  if (path.startsWith('/app/properties')) return 'Properties';
  if (path.startsWith('/app/referral')) return 'Referrals';
  if (path.startsWith('/app/chat')) return 'Support Inbox';
  if (path.startsWith('/app/investor-chat')) return 'Investor Chat';
  if (path.startsWith('/app/live-visitors')) return 'Live Visitors';
  if (path.startsWith('/app/settings')) return 'Settings';
  if (path.startsWith('/app/notifications')) return 'Notification Center';
  if (path.startsWith('/app/history')) return 'History';
  if (path.startsWith('/admin')) return 'Admin Panel';
  return path || 'Unknown Page';
};

const formatLastSeen = (dateStr?: string) => {
  if (!dateStr) return 'Never active';
  const date = new Date(dateStr);
  const diffMs = new Date().getTime() - date.getTime();
  if (diffMs <= 0) return 'Just now';

  let seconds = Math.floor(diffMs / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  seconds = seconds % 60;
  minutes = minutes % 60;
  hours = hours % 24;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

  return parts.join(', ') + ' ago';
};

/**
 * Tidio-style real-time visitor panel: who's online right now, what page
 * they're on, their recent page history, and a watch/follow toggle that
 * alerts the admin (toast + in-app + push) the moment a watched user comes
 * online.
 *
 * `onlineUsers` is passed in rather than self-managed: Layout.tsx already
 * owns the single 'online_users' presence channel (it's the one that
 * tracks the current user's own presence). If this component opened its
 * own competing subscription to that same topic, the two `.subscribe()`
 * callbacks race and Layout's own `track()` call can silently never fire —
 * so there is exactly one source of truth, threaded down via <Outlet
 * context> on the client side (see LiveVisitors.tsx) or passed directly
 * when embedded elsewhere (e.g. the admin dashboard, which is a sibling
 * layout with no such channel already open).
 */
export default function LiveVisitorsPanel({ onlineUsers, onInspectUser }: { onlineUsers: OnlineUser[]; onInspectUser?: (userId: string) => void }) {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<LiteUser[]>([]);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [watchedUserIds, setWatchedUserIds] = useState<Set<string>>(new Set());
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [visitorHistory, setVisitorHistory] = useState<Record<string, { path: string; created_at: string }[]>>({});
  const [loadingHistoryFor, setLoadingHistoryFor] = useState<string | null>(null);

  const previousOnlineIdsRef = useRef<Set<string>>(new Set());
  const lastAlertedAtRef = useRef<Record<string, number>>({});
  const expandedVisitorIdRef = useRef<string | null>(null);

  useEffect(() => {
    expandedVisitorIdRef.current = expandedVisitorId;
  }, [expandedVisitorId]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, name, email');
    setUsers(data || []);
  };

  const fetchWatchedUsers = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('admin_watched_users').select('target_user_id').eq('admin_id', user.id);
    setWatchedUserIds(new Set((data || []).map((r: any) => r.target_user_id)));
  };

  const toggleWatch = async (targetUserId: string, targetName: string) => {
    if (!user?.id) return;
    const isWatching = watchedUserIds.has(targetUserId);
    try {
      if (isWatching) {
        await supabase.from('admin_watched_users').delete().eq('admin_id', user.id).eq('target_user_id', targetUserId);
        setWatchedUserIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        toast.success(`Stopped watching ${targetName}`);
      } else {
        await supabase.from('admin_watched_users').insert({ admin_id: user.id, target_user_id: targetUserId });
        setWatchedUserIds(prev => new Set(prev).add(targetUserId));
        toast.success(`Watching ${targetName} — you'll be alerted when they come online`);
      }
    } catch (err: any) {
      toast.error('Failed to update watch: ' + err.message);
    }
  };

  const fetchVisitHistory = async (userId: string) => {
    setLoadingHistoryFor(userId);
    try {
      const { data } = await supabase
        .from('user_page_visits')
        .select('path, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      setVisitorHistory(prev => ({ ...prev, [userId]: data || [] }));
    } finally {
      setLoadingHistoryFor(null);
    }
  };

  const toggleVisitorExpanded = (userId: string) => {
    if (expandedVisitorId === userId) {
      setExpandedVisitorId(null);
      return;
    }
    setExpandedVisitorId(userId);
    fetchVisitHistory(userId);
  };

  useEffect(() => {
    fetchUsers();
    fetchWatchedUsers();
  }, [user?.id]);

  // Live-refresh an expanded visitor's page history the moment they navigate.
  useEffect(() => {
    const visitsChannel = supabase
      .channel('realtime_page_visits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_page_visits' }, (payload: any) => {
        const visitedUserId = payload.new?.user_id;
        if (visitedUserId && visitedUserId === expandedVisitorIdRef.current) {
          fetchVisitHistory(visitedUserId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(visitsChannel);
    };
  }, []);

  // Detect visitors who just transitioned offline -> online and alert any
  // admin watching them (push + in-app + toast). A 5-minute per-user
  // cooldown absorbs brief presence flicker from page navigation so a
  // watched user browsing around doesn't spam repeat alerts.
  useEffect(() => {
    const newOnlineIds = new Set(onlineUsers.map(l => l.user_id));
    const prevOnlineIds = previousOnlineIdsRef.current;
    const now = Date.now();
    onlineUsers.forEach(ou => {
      if (prevOnlineIds.has(ou.user_id)) return;
      if (!watchedUserIds.has(ou.user_id)) return;
      const lastAlerted = lastAlertedAtRef.current[ou.user_id] || 0;
      if (now - lastAlerted < 5 * 60 * 1000) return;
      lastAlertedAtRef.current[ou.user_id] = now;

      const displayName = ou.name || ou.email || 'A watched user';
      toast(`${displayName} just came online`, {
        description: `Now viewing ${ou.current_page || 'the site'}`,
      });
      if (user?.id) {
        notifyUser({
          userId: user.id,
          title: 'Watched user online',
          message: `${displayName} just came online (viewing ${ou.current_page || 'the site'}).`,
          type: 'alert',
          link: '/admin/users',
        });
      }
    });
    previousOnlineIdsRef.current = newOnlineIds;
  }, [onlineUsers, watchedUserIds, user?.id]);

  const search = visitorSearch.trim().toLowerCase();
  const filtered = onlineUsers.filter(ou => {
    if (!search) return true;
    const matchedUser = users.find(u => u.id === ou.user_id);
    const name = (ou.name || matchedUser?.name || '').toLowerCase();
    const email = (ou.email || matchedUser?.email || '').toLowerCase();
    return name.includes(search) || email.includes(search);
  });
  const sorted = [...filtered].sort((a, b) => {
    const aWatched = watchedUserIds.has(a.user_id) ? 1 : 0;
    const bWatched = watchedUserIds.has(b.user_id) ? 1 : 0;
    return bWatched - aWatched;
  });

  return (
    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-bold flex items-center gap-2 text-white">
          <span className="w-2 h-2 bg-emerald-550 rounded-full animate-ping shrink-0" />
          Live Visitors ({onlineUsers.length})
        </h3>
        <div className="flex items-center gap-1.5">
          {watchedUserIds.size > 0 && (
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <BellRing size={10} /> {watchedUserIds.size} watched
            </span>
          )}
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Real-time Presence</span>
        </div>
      </div>

      <input
        type="text"
        value={visitorSearch}
        onChange={(e) => setVisitorSearch(e.target.value)}
        placeholder="Search visitors by name or email…"
        className="w-full bg-slate-850 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="space-y-2 max-h-[520px] overflow-y-auto overscroll-contain pr-1">
        {onlineUsers.length === 0 ? (
          <p className="text-slate-500 text-xs py-8 text-center font-medium">No visitors currently active online.</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-500 text-xs py-8 text-center font-medium">No visitors match "{visitorSearch}".</p>
        ) : (
          sorted.map(ou => {
            const matchedUser = users.find(u => u.id === ou.user_id);
            const name = ou.name || matchedUser?.name || 'Active Visitor';
            const email = ou.email || matchedUser?.email || 'Monitoring page...';
            const isWatched = watchedUserIds.has(ou.user_id);
            const isExpanded = expandedVisitorId === ou.user_id;

            return (
              <div key={ou.user_id} className="bg-slate-850/50 hover:bg-slate-850 rounded-2xl border border-slate-800/60 transition overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <button
                    type="button"
                    onClick={() => toggleVisitorExpanded(ou.user_id)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 pr-2 text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white flex items-center gap-1">
                        {name}
                        {isWatched && <BellRing size={10} className="text-amber-400 shrink-0" />}
                      </p>
                      <p className="text-[10px] text-slate-450 truncate">{email}</p>
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md text-[9px] font-bold">
                          Viewing: {getPageLabel(ou.current_page)}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {matchedUser && (
                      <button
                        type="button"
                        onClick={() => toggleWatch(matchedUser.id, name)}
                        title={isWatched ? 'Stop watching' : 'Watch — get alerted when they come online'}
                        className={`p-1.5 rounded-lg border transition ${isWatched ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-amber-400'}`}
                      >
                        {isWatched ? <BellRing size={13} /> : <Bell size={13} />}
                      </button>
                    )}
                    {matchedUser && onInspectUser && (
                      <button
                        type="button"
                        onClick={() => onInspectUser(matchedUser.id)}
                        className="text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-1.5 rounded-lg transition"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-800/60 pt-2.5">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-2 flex items-center gap-1">
                      <Clock size={10} /> Recent page history
                    </p>
                    {loadingHistoryFor === ou.user_id ? (
                      <p className="text-slate-500 text-[10px] py-2">Loading history…</p>
                    ) : (visitorHistory[ou.user_id] || []).length === 0 ? (
                      <p className="text-slate-500 text-[10px] py-2">No recorded visits yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(visitorHistory[ou.user_id] || []).map((v, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 font-medium truncate max-w-[70%]">{getPageLabel(v.path)}</span>
                            <span className="text-slate-500 tabular-nums">{formatLastSeen(v.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
