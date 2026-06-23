import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LogOut, Home, Wallet, Briefcase, Settings, User, Shield, Lock, Gift, Building, 
  LayoutDashboard, Menu, X, MoreHorizontal
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useState } from 'react';

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Main navigation items for desktop sidebar
  const navItems = [
    { path: '/app', icon: Home, label: 'Dashboard' },
    { path: '/app/invest', icon: Briefcase, label: 'Invest' },
    { path: '/app/my-portfolio', icon: Wallet, label: 'Portfolio' },
    { path: '/app/wallet', icon: LayoutDashboard, label: 'Wallet' },
    { path: '/app/staking', icon: Lock, label: 'Staking' },
    { path: '/app/properties', icon: Building, label: 'Properties' },
    { path: '/app/referral', icon: Gift, label: 'Referral' },
    { path: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  // Bottom nav items (first 5) – the rest go in the hamburger menu
  const bottomNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="w-64 bg-white border-r border-gray-200 p-4 hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30">
        <div className="flex items-center justify-between mb-8">
          <span className="text-2xl font-bold text-brand">FidelityPro</span>
          <NotificationBell />
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <item.icon size={20} /> {item.label}
            </Link>
          ))}
          {profile?.is_admin && (
            <Link to="/admin" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-50 text-brand hover:bg-green-100 mt-4 border border-green-200">
              <Shield size={20} /> Admin Panel
            </Link>
          )}
        </nav>
        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2 mt-4 text-red-600 hover:bg-red-50 rounded-lg w-full">
          <LogOut size={20} /> Sign Out
        </button>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xl font-bold text-brand">FidelityPro</span>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2 space-y-1 shadow-md z-10">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                <item.icon size={18} /> {item.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-50 text-brand">
                <Shield size={18} /> Admin Panel
              </Link>
            )}
            <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg w-full">
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 p-4 pb-20 md:pb-6">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around py-2 z-30 shadow-lg">
          {bottomNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 text-xs text-gray-500 hover:text-brand transition"
            >
              <item.icon size={22} className="mx-auto" />
              <span className="truncate max-w-[50px]">{item.label}</span>
            </Link>
          ))}
          {/* "More" button that opens hamburger menu */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 text-xs text-gray-500 hover:text-brand transition"
          >
            <MoreHorizontal size={22} className="mx-auto" />
            <span>More</span>
          </button>
        </nav>
      </main>
    </div>
  );
}