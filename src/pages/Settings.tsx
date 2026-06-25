import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { User, Mail, Lock, Save, Eye, EyeOff, Shield, Bell, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { profile, refreshProfile } = useAuthStore();
  const [name, setName] = useState(profile?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated');
      setNewPassword(''); setConfirmPassword('');
      setPasswordSaved(true); setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const initials = (profile?.name || profile?.email || 'U')
    .split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');

  const passwordStrength = () => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '20%' };
    if (newPassword.length < 8) return { label: 'Weak', color: 'bg-amber-500', width: '40%' };
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && newPassword.length >= 10)
      return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
    return { label: 'Good', color: 'bg-blue-500', width: '70%' };
  };
  const strength = passwordStrength();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your profile and security preferences.</p>
      </div>

      {/* Avatar + Quick Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-5">
          <div className="w-18 h-18 relative">
            <div className="w-16 h-16 bg-gradient-to-br from-brand to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand/30">
              {initials}
            </div>
            {profile?.is_admin && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                <Shield size={10} className="text-white" />
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{profile?.name || 'Investor'}</p>
            <p className="text-gray-400 text-sm">{profile?.email}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {profile?.is_admin && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">Admin</span>
              )}
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <CheckCircle size={10} /> Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="p-2 bg-brand/10 rounded-xl"><User size={17} className="text-brand" /></div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Profile Information</h2>
            <p className="text-xs text-gray-400">Update your display name</p>
          </div>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="Your full name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email" value={profile?.email || ''} disabled
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <Bell size={11} /> Email changes require contacting support.
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit" disabled={loading}
              className="bg-brand hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? 'Saving...' : <><Save size={15} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="p-2 bg-red-50 rounded-xl"><Lock size={17} className="text-red-500" /></div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Change Password</h2>
            <p className="text-xs text-gray-400">Keep your account secure with a strong password</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="At least 6 characters" minLength={6} required
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Strength meter */}
            {strength && (
              <div className="mt-2">
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} rounded-full transition-all duration-300`} style={{ width: strength.width }} />
                </div>
                <p className="text-xs mt-1 text-gray-400">Password strength: <span className="font-medium text-gray-700">{strength.label}</span></p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent ${
                  confirmPassword && confirmPassword !== newPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                placeholder="Re-enter password" required
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit" disabled={loading}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? 'Updating...' : passwordSaved ? <><CheckCircle size={15} /> Updated!</> : <><Save size={15} /> Update Password</>}
            </button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Details</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Referral Code', value: profile?.referral_code || '—' },
            { label: 'Account Status', value: profile?.banned ? 'Banned' : 'Active' },
            { label: 'Can Invest', value: profile?.can_invest ? 'Yes' : 'No' },
            { label: 'Can Withdraw', value: profile?.can_withdraw ? 'Yes' : 'No' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
