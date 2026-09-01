import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabaseClient';
import { notifyAdminsWithEmail } from '../lib/notify';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function Signup() {
  const navigate = useNavigate();
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

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('Full name is required');
      toast.error('Full name is required');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      toast.error('Invalid email address');
      return;
    }
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
      // 1. Attempt signup via server-side Edge Function (handles profile creation & welcome email)
      let signupSuccess = false;
      let errorMessage = '';

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            full_name: cleanName,
            ref_code: refCode || null,
          }),
        });

        let result: any = {};
        try {
          result = await response.json();
        } catch {
          // non-JSON response
        }

        if (response.ok) {
          signupSuccess = true;
        } else {
          errorMessage =
            (typeof result.error === 'string' && result.error) ||
            (typeof result.message === 'string' && result.message) ||
            (result.msg) ||
            `Signup failed (${response.status})`;
        }
      } catch (networkErr: any) {
        console.warn('Signup edge function unreachable, attempting direct fallback:', networkErr);
      }

      // 2. Direct Supabase Auth fallback if Edge function was unreachable
      if (!signupSuccess && !errorMessage.toLowerCase().includes('already registered')) {
        const { data: authData, error: directErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: cleanName } },
        });

        if (directErr) {
          throw directErr;
        }
        if (authData.user) {
          signupSuccess = true;
        }
      } else if (!signupSuccess) {
        if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('duplicate')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error(errorMessage || 'Signup failed. Please try again.');
      }

      toast.success('Account created successfully!');

      // Notify admins via email (in addition to the DB push trigger)
      try {
        notifyAdminsWithEmail(
          `[RPM] New User Registered: ${cleanName} (${cleanEmail})`,
          `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
              <h2 style="color: #00674F; margin-bottom: 16px;">New User Registration</h2>
              <p><strong>Name:</strong> ${cleanName}</p>
              <p><strong>Email:</strong> ${cleanEmail}</p>
              ${refCode ? `<p><strong>Referred By Code:</strong> ${refCode}</p>` : ''}
              <p style="margin-top: 24px;">
                <a href="${window.location.origin}/admin/users" 
                   style="background: #00674F; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                   View User Management
                </a>
              </p>
            </div>
          `
        );
      } catch (_) {}

      // 3. Attempt immediate sign-in for seamless onboarding
      try {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!signInErr) {
          navigate('/app');
          return;
        }
      } catch {
        // Fall through to login page if immediate sign-in is delayed
      }

      navigate('/login');
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      if (msg.toLowerCase().includes('user already registered') || msg.toLowerCase().includes('already exists')) {
        msg = 'An account with this email already exists. Please log in.';
      }
      setError(msg);
      toast.error(msg);
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600 mt-2">Start earning with RPM</p>
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
