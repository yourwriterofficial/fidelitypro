import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LiveVisitorsPanel from '../components/LiveVisitorsPanel';
import type { LayoutOutletContext } from '../components/Layout';
import { ArrowUpRight } from 'lucide-react';

/**
 * Admin-only page reachable from the regular client shell (/app), so an
 * admin browsing as a "client" can still keep an eye on who's online in
 * real time without switching over to the /admin panel.
 */
export default function LiveVisitors() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const { onlineUsers } = useOutletContext<LayoutOutletContext>();

  if (!profile?.is_admin) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Live Visitors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time visitor presence, page history, and watch alerts.</p>
        </div>
        <button
          onClick={() => navigate('/admin/users')}
          className="text-sm font-semibold text-brand hover:text-brand-dark flex items-center gap-1.5 shrink-0"
        >
          Manage users in Admin Panel <ArrowUpRight size={15} />
        </button>
      </div>

      <LiveVisitorsPanel onlineUsers={onlineUsers} />
    </div>
  );
}
