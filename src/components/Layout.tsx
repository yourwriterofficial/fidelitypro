import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LogOut, Home, Wallet, Briefcase, Settings, Shield, Lock, Gift,
  Building, LayoutDashboard, Menu, X, MoreHorizontal, ChevronRight, AlertCircle,
  ChevronsLeft, ChevronsRight, MessageSquare, History, Users, Radio,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import NotificationBell from './NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import { toast } from 'sonner';

const navItems = [
  { path: '/app',             icon: Home,          label: 'Dashboard' },
  { path: '/app/invest',      icon: Briefcase,     label: 'Invest'    },
  { path: '/app/my-portfolio',icon: Wallet,        label: 'Portfolio' },
  { path: '/app/wallet',      icon: LayoutDashboard, label: 'Wallet'  },
  { path: '/app/staking',     icon: Lock,          label: 'Staking'   },
  { path: '/app/properties',  icon: Building,      label: 'Properties'},
  { path: '/app/referral',    icon: Gift,          label: 'Referral'  },
  { path: '/app/chat',        icon: MessageSquare, label: 'Support Inbox' },
  { path: '/app/investor-chat',icon: Users,        label: 'Investor Chat' },
  { path: '/app/live-visitors',icon: Radio,        label: 'Live Visitors', adminOnly: true },
  { path: '/app/history',     icon: History,       label: 'History'   },
  { path: '/app/settings',    icon: Settings,      label: 'Settings'  },
];

const bottomNavItems = navItems.slice(0, 5);

export interface OnlineVisitor {
  user_id: string;
  name: string;
  email: string;
  current_page: string;
  last_active: string;
}

export interface LayoutOutletContext {
  onlineUsers: OnlineVisitor[];
}

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('app-sidebar-collapsed') === '1'
  );
  const { restricted, withdrawRestricted, investRestricted, stakeRestricted, propertyRestricted } = useAccountRestriction();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [investorChatUnread, setInvestorChatUnread] = useState(0);
  const [investorChatFollowUnread, setInvestorChatFollowUnread] = useState(0);
  const lastLoggedPathRef = useRef<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineVisitor[]>([]);

  const onWallet = location.pathname.startsWith('/app/wallet');

  useEffect(() => {
    if (!profile?.id) return;
    
    const fetchUnreadCount = async () => {
      let query = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .eq('read', false);
        
      if (!profile.is_admin) {
        query = query.eq('user_id', profile.id);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        setUnreadChatCount(count);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('chat_unread_count')
      .on(
        'postgres_changes',
        profile.is_admin
          ? { event: '*', schema: 'public', table: 'messages' }
          : { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${profile.id}` },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.is_admin]);

  // Investor Chat unread badge — personal mentions/replies for everyone,
  // plus a separate "followed user posted" count for admins only. Both are
  // persisted via notifyUser() with link='/app/investor-chat' and cleared
  // when the user actually opens the page (see InvestorChat.tsx).
  useEffect(() => {
    if (!profile?.id) return;

    const FOLLOW_TITLES = new Set(['Followed user posted']);

    const fetchInvestorChatUnread = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('title')
        .eq('user_id', profile.id)
        .eq('read', false)
        .ilike('link', '/app/investor-chat%');

      if (error || !data) return;
      let personal = 0;
      let follow = 0;
      data.forEach((n: any) => {
        if (FOLLOW_TITLES.has(n.title)) follow++;
        else personal++;
      });
      setInvestorChatUnread(personal);
      setInvestorChatFollowUnread(follow);
    };

    fetchInvestorChatUnread();

    const channel = supabase
      .channel('investor_chat_unread_badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchInvestorChatUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Presence ('online_users') answers "who is online" only — it is tracked
  // ONCE per connection and never re-tracked on navigation. An earlier
  // version called .track() again on every route change to keep
  // current_page fresh, on the theory that re-tracking on the same open
  // channel just patches that connection's existing entry in place. In
  // practice, repeated track() calls on this Supabase/Phoenix setup each
  // added a NEW presence entry under the same user_id key instead of
  // replacing the old one — so the list only ever grew, and code reading
  // "the" entry for a user (e.g. array index 0) got stuck on whichever
  // stale entry happened to sort first, which is why Live Visitors always
  // showed the very first page ("Dashboard") a user landed on after login
  // and never updated after that.
  //
  // current_page is tracked separately instead, from `user_page_visits` —
  // a table already written on every navigation (see logPageVisit below)
  // purely for page-history purposes. Subscribing to INSERTs on it gives an
  // equally real-time, and far simpler, feed of "what page is this user on
  // right now" without touching presence's join/leave semantics at all.
  const [pageByUser, setPageByUser] = useState<Record<string, { path: string; at: string }>>({});

  useEffect(() => {
    if (!profile?.id) return;

    const presenceChannel = supabase.channel('online_users', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    // Single source of truth for who's online — descendant routes (e.g.
    // Live Visitors) read this via <Outlet context> instead of opening
    // their own competing subscription to the same 'online_users' topic
    // (which would race this effect's own subscribe/track callback).
    //
    // `supabase.channel(topic)` returns the EXISTING channel object if one
    // is already registered for that topic instead of creating a new one —
    // and `removeChannel()` tears it down asynchronously (it awaits an
    // unsubscribe round-trip before deregistering it). Under React Strict
    // Mode's dev-only mount→cleanup→mount double-invoke, the remount's
    // `channel()` call can therefore get back the previous mount's
    // still-subscribed channel before its teardown lands, and calling
    // `.on()` on an already-subscribed channel throws. Only wire up
    // listeners/subscribe when the channel is genuinely fresh ('closed');
    // an already-joining/joined channel is the still-live previous
    // instance doing the same job, so there's nothing to (re-)do.
    if (presenceChannel.state === 'closed') {
      presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const list: OnlineVisitor[] = [];
        Object.values(state).forEach((presenceList: any) => {
          if (!presenceList?.length) return;
          // Defense in depth: if more than one entry ever ends up under the
          // same key, prefer the most recently active one.
          const latest = presenceList.reduce((a: any, b: any) =>
            new Date(b.last_active || 0).getTime() > new Date(a.last_active || 0).getTime() ? b : a
          );
          list.push({
            user_id: latest.user_id,
            name: latest.name || 'User',
            email: latest.email || '',
            current_page: latest.current_page || '',
            last_active: latest.last_active || '',
          });
        });
        setOnlineUsers(list);
      });

      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: profile.id,
            name: profile.name || 'User',
            email: profile.email,
            current_page: location.pathname,
            last_active: new Date().toISOString()
          });
        }
      });
    }

    return () => {
      supabase.removeChannel(presenceChannel);
    };
    // location.pathname intentionally omitted: this only tracks the page the
    // user landed on when the connection was opened, as a fallback for the
    // brief window before their first user_page_visits row (below) arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Admins watch every user's page-visit inserts in real time so Live
  // Visitors reflects current_page immediately as anyone navigates.
  useEffect(() => {
    if (!profile?.is_admin) return;

    const visitsChannel = supabase
      .channel('admin_live_page_visits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_page_visits' }, (payload: any) => {
        const row = payload.new;
        if (!row?.user_id) return;
        setPageByUser(prev => ({ ...prev, [row.user_id]: { path: row.path, at: row.created_at } }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(visitsChannel);
    };
  }, [profile?.is_admin]);

  // Page Route Logging and Last Seen — run on every navigation.
  useEffect(() => {
    if (!profile?.id) return;

    // 1. Log page visit to user_page_visits table — guarded against firing
    // twice in a row for the same path (e.g. a profile object refresh that
    // doesn't represent an actual navigation).
    const logPageVisit = async () => {
      if (lastLoggedPathRef.current === location.pathname) return;
      lastLoggedPathRef.current = location.pathname;
      const nowIso = new Date().toISOString();
      // Optimistic local update — don't wait on the INSERT's realtime
      // round-trip just to see your own navigation reflected instantly.
      setPageByUser(prev => ({ ...prev, [profile.id]: { path: location.pathname, at: nowIso } }));
      await supabase.from('user_page_visits').insert({
        user_id: profile.id,
        path: location.pathname
      });
    };
    logPageVisit();

    // 2. Throttle last_seen updates in profiles table (max once per 5 seconds)
    const updateLastSeen = async () => {
      const now = new Date().toISOString();
      const lastUpdate = localStorage.getItem('last_seen_updated');
      if (!lastUpdate || (new Date(now).getTime() - new Date(lastUpdate).getTime() > 5000)) {
        await supabase
          .from('profiles')
          .update({ last_seen: now })
          .eq('id', profile.id);
        localStorage.setItem('last_seen_updated', now);
      }
    };
    updateLastSeen();
  }, [location.pathname, profile?.id]);

  // Merge the live page-visit feed into the presence list so Live Visitors
  // (and anything else reading onlineUsers) sees each user's actual current
  // page instead of the stale value from when their connection first opened.
  const onlineUsersWithLivePage = onlineUsers.map(u => ({
    ...u,
    current_page: pageByUser[u.user_id]?.path ?? u.current_page,
  }));

  useEffect(() => {
    localStorage.setItem('app-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Real-time In-App Toasts for incoming user notifications
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('in_app_notifications_toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload: any) => {
          const newNotif = payload.new;
          if (newNotif && !newNotif.read) {
            toast(newNotif.title, {
              description: newNotif.message,
              action: newNotif.link ? {
                label: 'View',
                onClick: () => navigate(newNotif.link)
              } : undefined,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, navigate]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Restricted (never-invested past the grace window) accounts may stay logged
  // in, but their view is limited to the Wallet page so they can top up.
  useEffect(() => {
    if (restricted && !onWallet) {
      navigate('/app/wallet', { replace: true });
    }
  }, [restricted, onWallet, navigate]);

  // When restricted, only the Wallet entry is shown in navigation. Admin-only
  // items (e.g. Live Visitors) are hidden from non-admin accounts.
  const visibleNavItems = restricted
    ? navItems.filter(n => n.path === '/app/wallet')
    : navItems.filter(n => !n.adminOnly || profile?.is_admin);
  const visibleBottomNavItems = restricted ? visibleNavItems : bottomNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path);

  return (
    <div className="h-screen h-[100dvh] bg-gray-50 flex flex-col md:flex-row overflow-hidden">

      {/* ===== DESKTOP SIDEBAR (collapsible) ===== */}
      <aside className={`bg-white border-r border-gray-100 hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 transition-[width] duration-200 ${collapsed ? 'md:w-20' : 'md:w-64'}`}>
        {/* Logo + collapse toggle */}
        <div className={`py-5 border-b border-gray-100 flex items-center ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
                <span className="text-white font-extrabold text-sm">R</span>
              </div>
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">RPM</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!collapsed && <NotificationBell />}
            {!collapsed && (
              <Link to="/app/chat"
                className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                title="Support Inbox">
                <MessageSquare size={19} className={location.pathname === '/app/chat' ? 'text-brand' : 'text-gray-400'} />
                {unreadChatCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 animate-pulse">
                    {unreadChatCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
          </div>
        </div>

        {/* User pill */}
        {profile && !collapsed && (
          <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center text-brand font-bold text-sm shrink-0">
              {profile.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p>
              <p className="text-xs text-gray-400 truncate">{profile.email}</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNavItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            const hasBadge = label === 'Support Inbox' || label === 'Investor Chat';
            return (
              <Link key={path} to={path} title={collapsed ? label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'} ${
                  active ? 'bg-brand text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                {!collapsed && label}
                {!collapsed && label === 'Support Inbox' && unreadChatCount > 0 && (
                  <span className="ml-auto w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse">
                    {unreadChatCount}
                  </span>
                )}
                {collapsed && label === 'Support Inbox' && unreadChatCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-white shadow-sm" />
                )}
                {!collapsed && label === 'Investor Chat' && (investorChatUnread > 0 || investorChatFollowUnread > 0) && (
                  <span className="ml-auto flex items-center gap-1">
                    {profile?.is_admin && investorChatFollowUnread > 0 && (
                      <span title="Followed users posted" className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                        {investorChatFollowUnread}
                      </span>
                    )}
                    {investorChatUnread > 0 && (
                      <span title="Replies & mentions" className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse">
                        {investorChatUnread}
                      </span>
                    )}
                  </span>
                )}
                {collapsed && label === 'Investor Chat' && (investorChatUnread > 0 || investorChatFollowUnread > 0) && (
                  <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${investorChatUnread > 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                )}
                {!collapsed && active && !hasBadge && <ChevronRight size={13} className="ml-auto opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="px-3 pb-4 space-y-0.5 border-t border-gray-100 pt-3">
          {profile?.is_admin && (
            <Link to="/admin" title={collapsed ? 'Admin Panel' : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'}`}>
              <Shield size={17} className="text-emerald-600" /> {!collapsed && 'Admin Panel'}
            </Link>
          )}
          <button onClick={handleSignOut} title={collapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'}`}>
            <LogOut size={17} /> {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`flex-1 flex flex-col min-h-0 min-w-0 max-w-full md:overflow-hidden transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>

        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">R</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900">RPM</span>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/app/investor-chat"
              className="relative p-2 rounded-xl text-gray-450 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Investor Chat">
              <Users size={19} className={location.pathname === '/app/investor-chat' ? 'text-brand' : 'text-gray-400'} />
              {investorChatUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 animate-pulse">
                  {investorChatUnread}
                </span>
              )}
              {profile?.is_admin && investorChatFollowUnread > 0 && (
                <span title="Followed users posted" className="absolute -bottom-0.5 -left-0.5 bg-amber-500 rounded-full w-2.5 h-2.5 border border-white shadow-sm" />
              )}
            </Link>
            <Link to="/app/chat"
              className="relative p-2 rounded-xl text-gray-450 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Support Inbox">
              <MessageSquare size={19} className={location.pathname === '/app/chat' ? 'text-brand' : 'text-gray-400'} />
              {unreadChatCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </Link>
            <NotificationBell />
            <button onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-xl transition ml-1">
              <Menu size={20} className="text-gray-600" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div 
          className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 w-full min-w-0"
          style={{ paddingBottom: 'var(--page-pb)' }}
        >
          {(restricted || withdrawRestricted || investRestricted || stakeRestricted || propertyRestricted) && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 flex items-start gap-3 px-4 py-3.5 shadow-sm shrink-0">
              <div className="p-1.5 rounded-lg bg-amber-100 shrink-0 mt-0.5">
                <AlertCircle size={15} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Account Status: Limited Access</p>
                <p className="text-xs mt-0.5 leading-relaxed text-amber-700">
                  {restricted && <>Your account is restricted to the Wallet page because you did not invest within the required grace period. <span className="font-semibold">Please top up your wallet to restore full access.</span></>}
                  {withdrawRestricted && !restricted && <>Your withdrawal features have been suspended due to account inactivity. <span className="font-semibold">Please make an investment or top up to restore access.</span></>}
                  {investRestricted && !restricted && <>Your investment features have been suspended due to account inactivity. <span className="font-semibold">Please top up your wallet to restore access.</span></>}
                  {propertyRestricted && !investRestricted && !restricted && <>Your property investment features have been suspended due to account inactivity. <span className="font-semibold">Please top up your wallet to restore access.</span></>}
                </p>
              </div>
            </div>
          )}
          {/* flex-1 wrapper so full-height pages like InvestorChat can fill remaining space.
              Every page root Outlet renders becomes a flex item of this flex-col container.
              Many pages use `max-w-* mx-auto` to center their content column on desktop — but
              an auto margin on a flex item's cross axis (width, here) opts that item OUT of
              the default stretch-to-fill behavior, so instead of being capped at the
              container's width it sizes to its content's max-content width (e.g. a table row
              with a long unbroken string), silently blowing out every ancestor's layout width.
              overflow-x-hidden/auto deeper in the tree then only clips the result instead of
              containing it — that's what caused pages to render cut off / shifted on mobile.
              min-w-0 removes the auto min-content floor; w-full gives the item a definite
              width so its own mx-auto centers it normally instead of disabling stretch. Both
              are applied via a child selector so every route's root gets this for free. */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col [&>*]:min-w-0 [&>*]:w-full">
            <Outlet context={{ onlineUsers: onlineUsersWithLivePage } satisfies LayoutOutletContext} />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
        >
          {visibleBottomNavItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                  active ? 'text-brand' : 'text-gray-400 hover:text-gray-600'
                }`}>
                <div className={`p-1 rounded-lg ${active ? 'bg-brand/10' : ''}`}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-medium truncate max-w-[48px]">{label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-gray-400 hover:text-gray-600 transition">
            <div className="p-1 rounded-lg">
              <MoreHorizontal size={20} />
            </div>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </main>

      {/* ===== MOBILE MENU — fixed bottom sheet (renders in viewport, no scroll needed) ===== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-sheet-up">
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <p className="text-base font-bold text-gray-900">Menu</p>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div 
              className="overflow-y-auto px-3 pb-6 space-y-0.5"
              style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
            >
              {profile && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center text-brand font-bold text-sm shrink-0">
                    {profile.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p>
                    <p className="text-xs text-gray-400 truncate">{profile.email}</p>
                  </div>
                </div>
              )}
              {visibleNavItems.map(({ path, icon: Icon, label }) => {
                const active = isActive(path);
                return (
                  <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}
                    className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      active ? 'bg-brand text-white font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    <Icon size={16} className={active ? 'text-white' : 'text-gray-400'} />
                    <span>{label}</span>
                    {label === 'Support Inbox' && unreadChatCount > 0 && (
                      <span className="ml-auto w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse">
                        {unreadChatCount}
                      </span>
                    )}
                    {label === 'Investor Chat' && (investorChatUnread > 0 || investorChatFollowUnread > 0) && (
                      <span className="ml-auto flex items-center gap-1">
                        {profile?.is_admin && investorChatFollowUnread > 0 && (
                          <span title="Followed users posted" className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {investorChatFollowUnread}
                          </span>
                        )}
                        {investorChatUnread > 0 && (
                          <span title="Replies & mentions" className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse">
                            {investorChatUnread}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
              {profile?.is_admin && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50">
                  <Shield size={16} /> Admin Panel
                </Link>
              )}
              <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
