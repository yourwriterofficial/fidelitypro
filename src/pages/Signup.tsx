import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refCode, setRefCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setRefCode(ref);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      toast.error('Password too short');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password, name);
      
      // After signup, handle referral if user is logged in (email confirmation not required)
      if (!result.needsEmailConfirm) {
        const { user } = useAuthStore.getState();
        if (user && refCode) {
          // Find referrer by referral_code
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', refCode)
            .single();
          if (referrer) {
            // Update profile with referred_by
            await supabase
              .from('profiles')
              .update({ referred_by: referrer.id })
              .eq('id', user.id);
            // Create referral record
            await supabase.from('referrals').insert({
              referrer_id: referrer.id,
              referee_id: user.id,
              level: 1,
              status: 'pending',
            });
          }
        }
        toast.success('Account created! Redirecting...');
        navigate('/app');
      } else {
        toast.success('Account created! Check your email to confirm.');
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600 mt-2">Start earning with FidelityPro</p>
          {refCode && <p className="text-xs text-brand mt-1">Referred by: <strong>{refCode}</strong></p>}
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
          </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? 'Creating account...' : <><UserPlus size={18} /> Sign Up</>}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account? <Link to="/login" className="text-brand font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}