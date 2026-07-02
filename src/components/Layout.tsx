import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LogOut, Home, Wallet, Briefcase, Settings, Shield, Lock, Gift,
  Building, LayoutDashboard, Menu, X, MoreHorizontal, ChevronRight, AlertCircle,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';
import { useAccountRestriction } from '../hooks/useAccountRestriction';

const navItems = [
  { path: '/app',             icon: Home,          label: 'Dashboard' },
  { path: '/app/invest',      icon: Briefcase,     label: 'Invest'    },
  { path: '/app/my-portfolio',icon: Wallet,        label: 'Portfolio' },
  { path: '/app/wallet',      icon: LayoutDashboard, label: 'Wallet'  },
  { path: '/app/staking',     icon: Lock,          label: 'Staking'   },
  { path: '/app/properties',  icon: Building,      label: 'Properties'},
  { path: '/app/referral',    icon: Gift,          label: 'Referral'  },
  { path: '/app/settings',    icon: Settings,      label: 'Settings'  },
];

const bottomNavItems = navItems.slice(0, 5);

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('app-sidebar-collapsed') === '1'
  );
  const { restricted, withdrawRestricted, investRestricted, stakeRestricted, propertyRestricted } = useAccountRestriction();

  const onWallet = location.pathname.startsWith('/app/wallet');

  useEffect(() => {
    localStorage.setItem('app-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

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

  // When restricted, only the Wallet entry is shown in navigation.
  const visibleNavItems = restricted ? navItems.filter(n => n.path === '/app/wallet') : navItems;
  const visibleBottomNavItems = restricted ? visibleNavItems : bottomNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

      {/* ===== DESKTOP SIDEBAR (collapsible) ===== */}
      <aside className={`bg-white border-r border-gray-100 hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 transition-[width] duration-200 ${collapsed ? 'md:w-20' : 'md:w-64'}`}>
        {/* Logo + collapse toggle */}
        <div className={`py-5 border-b border-gray-100 flex items-center ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
                <span className="text-white font-extrabold text-sm">F</span>
              </div>
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">FidelityPro</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!collapsed && <NotificationBell />}
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
            return (
              <Link key={path} to={path} title={collapsed ? label : undefined}
                className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2.5'} ${
                  active ? 'bg-brand text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                {!collapsed && label}
                {!collapsed && active && <ChevronRight size={13} className="ml-auto opacity-70" />}
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
      <main className={`flex-1 min-h-screen flex flex-col transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>

        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">F</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900">FidelityPro</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-xl transition">
              <Menu size={20} className="text-gray-600" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {(restricted || withdrawRestricted || investRestricted || stakeRestricted || propertyRestricted) && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 flex items-start gap-3 px-4 py-3.5 shadow-sm">
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
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
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

            <div className="overflow-y-auto px-3 pb-6 space-y-0.5">
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
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      active ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    <Icon size={16} /> {label}
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
