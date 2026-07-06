import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, LogIn, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'password' | 'magic'>('password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (method === 'password') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('Supabase signIn error:', signInError);
          throw new Error(signInError.message);
        }

        if (!data.user) throw new Error('No user returned');

        toast.success('Welcome back!');
        navigate('/app');
      } else {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });

        if (otpError) {
          console.error('Supabase Magic Link error:', otpError);
          throw new Error(otpError.message);
        }

        toast.success('Magic link sent! Please check your email.');
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      // Network errors
      if (msg.includes('fetch') || msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('NetworkError')) {
        msg = 'Network error – please check your internet connection and Supabase URL.';
      }
      setError(msg);
      toast.error(msg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Sign in to your RPM account</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 mb-6">
          <button
            type="button"
            onClick={() => { setMethod('password'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${method === 'password' ? 'border-brand text-brand' : 'border-transparent text-gray-400'}`}
          >
            Password Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMethod('magic'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${method === 'magic' ? 'border-brand text-brand' : 'border-transparent text-gray-400'}`}
          >
            Magic Link (Passwordless)
          </button>
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

          {method === 'password' && (
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
          )}

          {method === 'password' && (
            <div className="text-right">
              <Link to="/reset-password" className="text-sm text-brand hover:underline">Forgot password?</Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              'Authenticating...'
            ) : method === 'password' ? (
              <><LogIn size={18} /> Sign In</>
            ) : (
              <><Sparkles size={18} /> Send Magic Link</>
            )}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account? <Link to="/signup" className="text-brand font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}