import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthGuard() {
  const { user, profile, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth initialization before redirecting — prevents false logouts
    // during a token refresh cycle where user may be briefly null.
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.banned) {
      navigate('/banned', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  return <Outlet />;
}