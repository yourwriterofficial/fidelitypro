import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LogOut, LayoutDashboard, Package, Users, DollarSign, ShoppingCart,
  Eye, Mail, CreditCard, Settings, Lock, Building, Gift, Bell,
  Menu, X, MoreHorizontal, Activity, Megaphone, ChevronRight, ArrowLeftRight,
  ChevronsLeft, ChevronsRight, MessageSquare,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/admin',              icon: LayoutDashboard, label: 'Dashboard'      },
      { path: '/admin/logs',         icon: Activity,        label: 'Activity Logs'  },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/admin/orders',       icon: ShoppingCart,    label: 'Orders'         },
      { path: '/admin/deposits',     icon: CreditCard,      label: 'Deposits'       },
      { path: '/admin/withdrawals',  icon: DollarSign,      label: 'Withdrawals'    },
    ],
  },
  {
    label: 'Products',
    items: [
      { path: '/admin/products',     icon: Package,         label: 'Products'       },
      { path: '/admin/staking',      icon: Lock,            label: 'Staking'        },
      { path: '/admin/properties',   icon: Building,        label: 'Listings'       },
      { path: '/admin/referrals',    icon: Gift,            label: 'Referrals'      },
    ],
  },
  {
    label: 'Users & Comms',
    items: [
      { path: '/admin/users',            icon: Users,       label: 'Users'          },
      { path: '/admin/chat',             icon: MessageSquare,label: 'Live Chat'        },
      { path: '/admin/notifications',    icon: Bell,        label: 'Notifications'  },
      { path: '/admin/announcements',    icon: Megaphone,   label: 'Announcements'  },
      { path: '/admin/email-templates',  icon: Mail,        label: 'Email Templates'},
      { path: '/admin/email-logs',       icon: Mail,        label: 'Email Logs'     },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/admin/settings',     icon: Settings,        label: 'Settings'       },
    ],
  },
];

const allNavItems = NAV_SECTIONS.flatMap(s => s.items);
const bottomNavItems = allNavItems.slice(0, 5);

export default function AdminLayout() {
  const { signOut, isImpersonating, clearImpersonation, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('admin-sidebar-collapsed') === '1'
  );
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .eq('read', false);
      if (!error && count !== null) {
        setUnreadChatCount(count);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('admin_chat_unread_count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const switchToClient = () => {
    if (isImpersonating) clearImpersonation();
    navigate('/app');
  };

  const isActive = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

      {/* ===== DESKTOP SIDEBAR (collapsible) ===== */}
      <aside className={`bg-white border-r border-gray-100 hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 transition-[width] duration-200 ${collapsed ? 'md:w-20' : 'md:w-64'}`}>
        {/* Logo + collapse toggle */}
        <div className={`px-3 py-5 border-b border-gray-100 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-5'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-extrabold text-sm">R</span>
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900 leading-none">RPM</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Admin Panel</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        {/* Impersonation banner */}
        {isImpersonating && !collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium flex items-center gap-1.5">
            <Eye size={12} className="shrink-0" /> Viewing as client
          </div>
        )}

        {/* Sectioned nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3.5 mb-1">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ path, icon: Icon, label }) => {
                  const active = isActive(path);
                  return (
                    <Link key={path} to={path} title={collapsed ? label : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'} ${
                        active ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}>
                      <Icon size={16} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                      {!collapsed && label}
                      {!collapsed && label === 'Live Chat' && unreadChatCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          {unreadChatCount}
                        </span>
                      )}
                      {collapsed && label === 'Live Chat' && unreadChatCount > 0 && (
                        <span className="absolute top-1 right-2 bg-red-500 w-2 h-2 rounded-full" />
                      )}
                      {!collapsed && active && label !== 'Live Chat' && <ChevronRight size={12} className="ml-auto opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-gray-100 space-y-0.5">
          <button onClick={switchToClient} title={collapsed ? (isImpersonating ? 'Exit Impersonation' : 'Switch to Client') : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-brand hover:bg-brand/5 transition ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'}`}>
            <ArrowLeftRight size={16} />
            {!collapsed && (isImpersonating ? 'Exit Impersonation' : 'Switch to Client')}
          </button>
          <button onClick={handleSignOut} title={collapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'}`}>
            <LogOut size={16} /> {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`flex-1 min-h-screen flex flex-col transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>

        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">R</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">RPM</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest">Admin</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition">
            <Menu size={20} className="text-gray-600" />
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
          {bottomNavItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                  active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}>
                <div className={`p-1 rounded-lg ${active ? 'bg-gray-900/10' : ''}`}>
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
            {/* Grabber + header */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <p className="text-base font-bold text-gray-900">Admin Menu</p>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto px-3 pb-6 space-y-3">
              {isImpersonating && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium flex items-center gap-1.5">
                  <Eye size={11} /> Viewing as client
                </div>
              )}
              {NAV_SECTIONS.map(section => (
                <div key={section.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">{section.label}</p>
                  <div className="space-y-0.5">
                    {section.items.map(({ path, icon: Icon, label }) => {
                      const active = isActive(path);
                      return (
                        <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                            active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}>
                          <Icon size={15} /> {label}
                          {label === 'Live Chat' && unreadChatCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                              {unreadChatCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="space-y-0.5 pt-1 border-t border-gray-100">
                <button onClick={() => { switchToClient(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-brand hover:bg-brand/5 transition">
                  <ArrowLeftRight size={15} /> {isImpersonating ? 'Exit Impersonation' : 'Switch to Client'}
                </button>
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition">
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
