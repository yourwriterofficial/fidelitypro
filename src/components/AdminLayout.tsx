import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LogOut, LayoutDashboard, Package, Users, DollarSign, ShoppingCart, 
  Eye, Mail, CreditCard, Settings, Lock, Building, Gift, Bell, 
  Menu, X, MoreHorizontal, Activity
} from 'lucide-react';
import { useState } from 'react';

export default function AdminLayout() {
  const { signOut, isImpersonating, clearImpersonation } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const switchToClient = () => {
    if (isImpersonating) {
      clearImpersonation();
    }
    navigate('/app');
  };

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/admin/deposits', icon: CreditCard, label: 'Deposits' },
    { path: '/admin/withdrawals', icon: DollarSign, label: 'Withdrawals' },
    { path: '/admin/products', icon: Package, label: 'Products' },
    { path: '/admin/staking', icon: Lock, label: 'Staking' },
    { path: '/admin/properties', icon: Building, label: 'Properties' },
    { path: '/admin/referrals', icon: Gift, label: 'Referrals' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/notifications', icon: Bell, label: 'Notifications' },
    { path: '/admin/email-templates', icon: Mail, label: 'Email Templates' },
    { path: '/admin/announcements', icon: Bell, label: 'Announcements' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
    { path: '/admin/logs', icon: Activity, label: 'Activity Logs' },
  ];

  const bottomNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <aside className="w-64 bg-white border-r border-gray-200 p-4 hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-2xl font-bold text-brand">Admin</span>
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
        </nav>
        <button
          onClick={switchToClient}
          className="flex items-center gap-3 px-4 py-2 mt-4 text-brand hover:bg-green-50 rounded-lg w-full"
        >
          <Eye size={20} /> {isImpersonating ? 'Back to Admin' : 'Switch to Client'}
        </button>
        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2 mt-2 text-red-600 hover:bg-red-50 rounded-lg w-full">
          <LogOut size={20} /> Sign Out
        </button>
      </aside>

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Mobile header */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xl font-bold text-brand">Admin</span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
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
            <button onClick={switchToClient} className="flex items-center gap-3 px-4 py-2 text-brand hover:bg-green-50 rounded-lg w-full">
              <Eye size={18} /> {isImpersonating ? 'Back to Admin' : 'Switch to Client'}
            </button>
            <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg w-full">
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}

        <div className="flex-1 p-4 pb-20 md:pb-6">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
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