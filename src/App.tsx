import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from './providers/QueryProvider';
import { useAuthStore } from './store/authStore';
import AuthGuard from './components/AuthGuard';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import BannedPage from './pages/BannedPage';
import Dashboard from './pages/Dashboard';
import Invest from './pages/Invest';
import MyPortfolio from './pages/MyPortfolio';
import Wallet from './pages/Wallet';
import Staking from './pages/Staking';
import Properties from './pages/Properties';
import Referral from './pages/Referral';
import Settings from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminDeposits from './pages/admin/AdminDeposits';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminProducts from './pages/admin/AdminProducts';
import AdminStaking from './pages/admin/AdminStaking';
import AdminProperties from './pages/admin/AdminProperties';
import AdminReferrals from './pages/admin/AdminReferrals';
import AdminUsers from './pages/admin/AdminUsers';
import AdminNotifications from './pages/admin/AdminNotifications';
import EmailTemplates from './pages/admin/EmailTemplates';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';

function App() {
  const { initAuth, setLoading } = useAuthStore();

  useEffect(() => {
    initAuth();
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [initAuth, setLoading]);

  return (
    <QueryProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors theme="light" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/banned" element={<BannedPage />} />

          {/* Protected User Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AuthGuard />}>
              <Route path="/app" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="invest" element={<Invest />} />
                <Route path="my-portfolio" element={<MyPortfolio />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="staking" element={<Staking />} />
                <Route path="properties" element={<Properties />} />
                <Route path="referral" element={<Referral />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute adminOnly />}>
            <Route element={<AuthGuard />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="deposits" element={<AdminDeposits />} />
                <Route path="withdrawals" element={<AdminWithdrawals />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="staking" element={<AdminStaking />} />
                <Route path="properties" element={<AdminProperties />} />
                <Route path="referrals" element={<AdminReferrals />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="email-templates" element={<EmailTemplates />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logs" element={<AdminActivityLogs />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;