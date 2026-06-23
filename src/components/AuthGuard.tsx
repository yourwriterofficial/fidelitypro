import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthGuard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.banned) {
      navigate('/banned', { replace: true });
    }
  }, [user, profile, navigate]);

  return <Outlet />;
}