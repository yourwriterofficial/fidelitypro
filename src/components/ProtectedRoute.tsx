import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, profile, loading, isImpersonating } = useAuthStore();

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // If adminOnly and not admin (and not impersonating an admin)
  if (adminOnly && !profile?.is_admin && !isImpersonating) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}