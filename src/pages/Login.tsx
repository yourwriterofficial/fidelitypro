import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/app');
    } catch (err: any) {
      let msg = err.message || 'Invalid credentials';
      // Network errors
      if (msg.includes('fetch') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
        msg = 'Network error – please check your internet connection and Supabase URL.';
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Sign in to your FidelityPro account</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div className="text-right">
            <Link to="/reset-password" className="text-sm text-brand hover:underline">Forgot password?</Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account? <Link to="/signup" className="text-brand font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}