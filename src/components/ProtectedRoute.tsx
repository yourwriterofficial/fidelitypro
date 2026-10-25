import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PageLoader from './PageLoader';

export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, profile, loading, isImpersonating } = useAuthStore();

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // If adminOnly, ensure we wait for profile to resolve before deciding
  if (adminOnly) {
    if (!profile && !isImpersonating) {
      return <div className="flex justify-center items-center h-screen bg-gray-50"><PageLoader /></div>;
    }
    if (!profile?.is_admin && !isImpersonating) {
      return <Navigate to="/app" replace />;
    }
  }

  return <Outlet />;
}
