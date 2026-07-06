import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Ban, LogOut } from 'lucide-react';

export default function BannedPage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    toast.info('You have been logged out.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-red-100 rounded-full">
            <Ban size={48} className="text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-gray-600 mb-2">
          Your account has been banned from using RPM.
        </p>
        {profile?.ban_reason && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4">
            Reason: {profile.ban_reason}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Log Out
        </button>
        <p className="text-xs text-gray-400 mt-4">
          If you believe this is a mistake, please contact support.
        </p>
      </div>
    </div>
  );
}