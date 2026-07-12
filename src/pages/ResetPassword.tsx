import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Mail, Send, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'request' | 'sent' | 'set-password' | 'done';

export default function ResetPassword() {
  const { resetPassword } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState('');

  // If the user arrived here by clicking the emailed link, Supabase's
  // detectSessionInUrl already parsed the recovery token from the URL and
  // established a session — skip straight to setting a new password
  // instead of showing the "request a link" form again.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep('set-password');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStep('set-password');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email');
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setStep('sent');
      toast.success('Password reset email sent!');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.trim().length < 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setVerifyingOtp(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'recovery',
      });
      if (verifyErr) throw verifyErr;
      if (!data.session) throw new Error('Could not verify code');
      setStep('set-password');
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired code';
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setStep('done');
      toast.success('Password updated!');
      setTimeout(() => navigate('/app'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        {step !== 'set-password' && step !== 'done' && (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
            <p className="text-gray-600 mt-2">
              {step === 'request' ? 'Enter your email to receive a reset link.' : 'Check your inbox for the link or code.'}
            </p>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}

        {step === 'request' && (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : <><Send size={18} /> Send Reset Link</>}
            </button>
            <p className="text-center text-sm text-gray-600 mt-4">
              <Link to="/login" className="text-brand font-medium hover:underline">Back to Login</Link>
            </p>
          </form>
        )}

        {step === 'sent' && (
          <div className="space-y-5">
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-center">
              <p className="font-medium">Check your inbox</p>
              <p className="text-sm mt-1">We've sent a password reset link and a 6-digit code to <strong>{email}</strong></p>
            </div>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">6-digit code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent tracking-[0.3em] font-mono text-lg"
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
                {verifyingOtp ? 'Verifying...' : <><KeyRound size={18} /> Verify Code</>}
              </button>
            </form>
            <p className="text-center text-sm text-gray-600">
              <button type="button" onClick={() => { setStep('request'); setOtp(''); setError(''); }} className="text-brand font-medium hover:underline">
                Use a different email
              </button>
              {' · '}
              <Link to="/login" className="text-brand font-medium hover:underline">Back to Login</Link>
            </p>
          </div>
        )}

        {step === 'set-password' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Set New Password</h2>
              <p className="text-gray-600 mt-2">Choose a new password for your account.</p>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
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
                {loading ? 'Updating...' : <><Lock size={18} /> Set New Password</>}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="bg-emerald-50 text-emerald-700 p-6 rounded-xl text-center">
            <CheckCircle2 className="mx-auto mb-2" size={36} />
            <p className="font-medium">Password updated!</p>
            <p className="text-sm mt-1">Redirecting you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}
