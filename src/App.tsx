import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from './providers/QueryProvider';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGuard from './components/AuthGuard';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import PushAutoSubscriber from './components/PushAutoSubscriber';
import PWAUpdater from './components/PWAUpdater';
import InstallPWAPrompt from './components/InstallPWAPrompt';
import PageLoader from './components/PageLoader';
import { triggerPassiveHeartbeat } from './lib/heartbeat';

// ── Lazy-loaded Public Pages ──────────────────────────────────────────────────
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const BannedPage = lazy(() => import('./pages/BannedPage'));
const Plans = lazy(() => import('./pages/Plans'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Careers = lazy(() => import('./pages/Careers'));
const Security = lazy(() => import('./pages/Security'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

// ── Lazy-loaded User Pages ────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Invest = lazy(() => import('./pages/Invest'));
const MyPortfolio = lazy(() => import('./pages/MyPortfolio'));
const Wallet = lazy(() => import('./pages/Wallet'));
const P2P = lazy(() => import('./pages/P2P'));
const Staking = lazy(() => import('./pages/Staking'));
const Properties = lazy(() => import('./pages/Properties'));
const Referral = lazy(() => import('./pages/Referral'));
const Settings = lazy(() => import('./pages/Settings'));
const Chat = lazy(() => import('./pages/Chat'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const InvestorChat = lazy(() => import('./pages/InvestorChat'));
const LiveVisitors = lazy(() => import('./pages/LiveVisitors'));

// ── Lazy-loaded Admin Pages ───────────────────────────────────────────────────
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminDeposits = lazy(() => import('./pages/admin/AdminDeposits'));
const AdminWithdrawals = lazy(() => import('./pages/admin/AdminWithdrawals'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminStaking = lazy(() => import('./pages/admin/AdminStaking'));
const AdminProperties = lazy(() => import('./pages/admin/AdminProperties'));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminKYC = lazy(() => import('./pages/admin/AdminKYC'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const EmailTemplates = lazy(() => import('./pages/admin/EmailTemplates'));
const AdminEmailLogs = lazy(() => import('./pages/admin/AdminEmailLogs'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminActivityLogs = lazy(() => import('./pages/admin/AdminActivityLogs'));
const AdminChat = lazy(() => import('./pages/admin/AdminChat'));
const AdminP2P = lazy(() => import('./pages/admin/AdminP2P'));

function App() {
  const { initAuth, setLoading } = useAuthStore();

  useEffect(() => {
    initAuth();
    triggerPassiveHeartbeat();
    // Watchdog fallback reduced from 5s to 1.2s to prevent lingering spinners
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [initAuth, setLoading]);

  return (
    <QueryProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Toaster position="top-center" richColors theme="light" />
          <PushAutoSubscriber />
          <PWAUpdater />
          <InstallPWAPrompt />
          <Suspense fallback={<PageLoader />}>
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
                    <Route path="p2p" element={<P2P />} />
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
                    <Route path="p2p" element={<AdminP2P />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="staking" element={<AdminStaking />} />
                    <Route path="properties" element={<AdminProperties />} />
                    <Route path="referrals" element={<AdminReferrals />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="kyc" element={<AdminKYC />} />
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
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryProvider>
  );
}

export default App;