import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, LogIn, Send, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'password' | 'magic' | 'otp'>('password');
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    const urlEmail = searchParams.get('email');
    const urlCode = searchParams.get('code') || searchParams.get('otp');
    const urlMethod = searchParams.get('method');

    if (urlEmail) setEmail(urlEmail.trim().toLowerCase());
    if (urlCode) {
      setOtp(urlCode.trim());
      setMethod('otp');
    } else if (urlMethod === 'otp' || urlMethod === 'magic') {
      setMethod(urlMethod as any);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address');
      toast.error('Email is required');
      return;
    }

    setLoading(true);

    try {
      if (method === 'password') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          console.error('Supabase signIn error:', signInError);
          throw new Error(signInError.message);
        }

        if (!data.user) throw new Error('No user returned');

        toast.success('Welcome back!');
        navigate('/app');
      } else if (method === 'magic') {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });

        if (otpError) {
          console.error('Supabase Magic Link error:', otpError);
          throw new Error(otpError.message);
        }

        setMethod('otp');
        toast.success('Sign-in code sent! Please enter the 6-digit code from your email.');
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Incorrect email or password. Please check your details or sign in with an OTP code.';
      } else if (msg.includes('fetch') || msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('NetworkError')) {
        msg = 'Network error – please check your internet connection.';
      }
      setError(msg);
      toast.error(msg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });
      if (verifyErr) throw verifyErr;
      if (!data.session) throw new Error('Could not verify code');
      toast.success('Welcome back!');
      navigate('/app');
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired 6-digit code. Please request a new one.';
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
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
            className={`flex-1 pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${method === 'password' ? 'border-brand text-brand' : 'border-transparent text-gray-400'}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMethod('otp'); setError(''); }}
            className={`flex-1 pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${method === 'otp' ? 'border-brand text-brand' : 'border-transparent text-gray-400'}`}
          >
            Email OTP
          </button>
          <button
            type="button"
            onClick={() => { setMethod('magic'); setError(''); }}
            className={`flex-1 pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${method === 'magic' ? 'border-brand text-brand' : 'border-transparent text-gray-400'}`}
          >
            Magic Link
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}

        {method === 'otp' ? (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-xs flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0 text-blue-600" />
              <span>Enter your registered email and the 6-digit OTP code sent to your inbox.</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative mt-1">
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
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">6-Digit Verification Code</label>
                <button
                  type="button"
                  onClick={async () => {
                    const cleanEmail = email.trim().toLowerCase();
                    if (!cleanEmail) {
                      toast.error('Enter your email first to send a new code');
                      return;
                    }
                    try {
                      await supabase.auth.signInWithOtp({ email: cleanEmail });
                      toast.success('New 6-digit code sent to your email!');
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to resend code');
                    }
                  }}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  Resend Code
                </button>
              </div>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent tracking-[0.3em] font-mono text-lg font-bold text-center"
                  placeholder="000000"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingOtp}
              className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {verifyingOtp ? 'Verifying Code...' : <><LogIn size={18} /> Verify & Sign In</>}
            </button>
          </form>
        ) : (
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
              <><Send size={18} /> Send Magic Link</>
            )}
          </button>
        </form>
        )}
        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account? <Link to="/signup" className="text-brand font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}