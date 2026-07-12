import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from './providers/QueryProvider';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
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
import Plans from './pages/Plans';
import HowItWorks from './pages/HowItWorks';
import About from './pages/About';
import Contact from './pages/Contact';
import Careers from './pages/Careers';
import Security from './pages/Security';
import FAQ from './pages/FAQ';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
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
import AdminEmailLogs from './pages/admin/AdminEmailLogs';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';
import PushAutoSubscriber from './components/PushAutoSubscriber';
import PWAUpdater from './components/PWAUpdater';
import Chat from './pages/Chat';
import NotificationsPage from './pages/NotificationsPage';
import HistoryPage from './pages/HistoryPage';
import InvestorChat from './pages/InvestorChat';
import LiveVisitors from './pages/LiveVisitors';
import AdminChat from './pages/admin/AdminChat';

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
      <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-center" richColors theme="light" />
        <PushAutoSubscriber />
        <PWAUpdater />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/banned" element={<BannedPage />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/security" element={<Security />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

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
                <Route path="chat" element={<Chat />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="investor-chat" element={<InvestorChat />} />
                <Route path="live-visitors" element={<LiveVisitors />} />
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
                <Route path="email-logs" element={<AdminEmailLogs />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logs" element={<AdminActivityLogs />} />
                <Route path="chat" element={<AdminChat />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </QueryProvider>
  );
}

export default App;