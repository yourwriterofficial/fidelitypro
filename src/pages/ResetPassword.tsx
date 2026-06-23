import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const { resetPassword } = useAuthStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSent(true);
      toast.success('Password reset link sent to your email!');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
          <p className="text-gray-600 mt-2">Enter your email to receive a reset link.</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}
        {sent ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center">
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm mt-1">We've sent a password reset link to <strong>{email}</strong></p>
            <Link to="/login" className="text-brand font-medium hover:underline mt-3 inline-block">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  );
}