import { useState, useEffect } from 'react';
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

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    email_info: true,
    email_warning: true,
    email_success: true,
    email_alert: true,
    push_info: true,
    push_warning: true,
    push_success: true,
    push_alert: true
  });

  // Admin Notification Lock State
  const [lockedNotifications, setLockedNotifications] = useState<Record<string, boolean>>({
    email_info: false,
    email_success: false,
    email_warning: true,
    email_alert: true,
    push_info: false,
    push_success: false,
    push_warning: true,
    push_alert: true
  });

  const [devices, setDevices] = useState<any[]>([]);

  const fetchPreferences = async () => {
    if (!profile?.id) return;
    try {
      // Fetch both locked settings and user preferences in parallel
      const [prefRes, lockRes] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'locked_notifications')
          .maybeSingle()
      ]);

      let activeLocked = {
        email_info: false,
        email_success: false,
        email_warning: true,
        email_alert: true,
        push_info: false,
        push_success: false,
        push_warning: true,
        push_alert: true
      };

      if (lockRes?.data?.value) {
        try {
          activeLocked = JSON.parse(lockRes.data.value);
          setLockedNotifications(activeLocked);
        } catch (e) {
          console.error('Failed parsing locked notifications settings', e);
        }
      }

      if (prefRes?.error) {
        if (prefRes.error.code === 'PGRST116') {
          // Record not found, insert default rows
          const defaults = {
            user_id: profile.id,
            email_info: true,
            email_warning: true,
            email_success: true,
            email_alert: true,
            push_info: true,
            push_warning: true,
            push_success: true,
            push_alert: true
          };
          await supabase.from('notification_preferences').insert(defaults);
          setPreferences(defaults);
        } else {
          throw prefRes.error;
        }
      } else if (prefRes?.data) {
        // Enforce that locked fields must be true in local state
        const mergedPrefs = { ...prefRes.data };
        Object.keys(activeLocked).forEach((key) => {
          if (activeLocked[key as keyof typeof activeLocked] === true) {
            mergedPrefs[key] = true;
          }
        });
        setPreferences(mergedPrefs);
      }

      // Fetch push subscriptions
      const subsRes = await supabase
        .from('push_subscriptions')
        .select('id, user_agent, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!subsRes.error) {
        setDevices(subsRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching preferences & devices:', err);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [profile?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('notification_locks_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.locked_notifications'
        },
        (payload: any) => {
          if (payload.new && payload.new.value) {
            try {
              const activeLocked = JSON.parse(payload.new.value);
              setLockedNotifications(activeLocked);
              
              // Synchronize checkboxes to true for newly locked preferences
              setPreferences(prev => {
                const updated = { ...prev };
                Object.keys(activeLocked).forEach((key) => {
                  if (activeLocked[key] === true) {
                    (updated as any)[key] = true;
                  }
                });
                return updated;
              });
            } catch (e) {
              console.error('Realtime locks sync error:', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTogglePreference = async (key: keyof typeof preferences) => {
    if (!profile?.id) return;
    if (lockedNotifications[key] === true) {
      toast.error('This notification setting is locked by the administrator.');
      return;
    }
    const newVal = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newVal }));
    
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: newVal })
        .eq('user_id', profile.id);
        
      if (error) throw error;
      toast.success('Notification preferences updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preferences');
      setPreferences(prev => ({ ...prev, [key]: !newVal })); // Revert on error
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success('Device push registration revoked.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke device registration.');
    }
  };

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

      {/* Notification Settings Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="p-2 bg-indigo-50 rounded-xl"><Bell size={17} className="text-indigo-600" /></div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Notification Preferences</h2>
            <p className="text-xs text-gray-400">Choose which emails and push alerts you receive</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Notifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'email_info', label: 'Support & Announcements', desc: 'Updates about your chat inquiries and platform news.' },
                { key: 'email_success', label: 'Successful Operations', desc: 'Confirmations of deposits, investments, and payouts.' },
                { key: 'email_warning', label: 'Account Safeguards', desc: 'Alerts when changes are made to your login credentials.' },
                { key: 'email_alert', label: 'Critical Account Events', desc: 'Essential updates regarding restrictions or mandatory fees.' },
              ].map(({ key, label, desc }) => {
                const isLocked = lockedNotifications[key] === true;
                return (
                  <div key={key} className={`flex items-start justify-between p-3.5 border rounded-xl transition ${
                    isLocked ? 'bg-gray-50/70 border-amber-100/60' : 'bg-gray-50 border-gray-100 hover:bg-gray-100/30'
                  }`}>
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <label className={`text-xs font-semibold text-gray-800 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`} htmlFor={key}>
                          {label}
                        </label>
                        {isLocked && (
                          <span className="text-[8px] bg-amber-50 text-amber-600 font-bold border border-amber-200/50 px-1 rounded uppercase tracking-wider">
                            Enforced
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-450 leading-relaxed">{desc}</p>
                    </div>
                    <input
                      id={key}
                      type="checkbox"
                      checked={isLocked ? true : ((preferences as any)[key] ?? true)}
                      disabled={isLocked}
                      onChange={() => handleTogglePreference(key as any)}
                      className={`w-4 h-4 rounded border-gray-300 focus:ring-brand shrink-0 mt-0.5 ${
                        isLocked 
                          ? 'text-amber-500 cursor-not-allowed bg-amber-50 border-amber-200 opacity-80' 
                          : 'text-brand cursor-pointer'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Push Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Push Alerts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'push_info', label: 'Live Chat & Messaging', desc: 'Immediate browser notices for support replies.' },
                { key: 'push_success', label: 'Transaction Notifications', desc: 'Realtime banners for earnings and stake confirmations.' },
                { key: 'push_warning', label: 'Security & Auth Notices', desc: 'Alerts for logins or security policy refreshes.' },
                { key: 'push_alert', label: 'Action-Required Warnings', desc: 'Critical instructions, restrictions, and deposit updates.' },
              ].map(({ key, label, desc }) => {
                const isLocked = lockedNotifications[key] === true;
                return (
                  <div key={key} className={`flex items-start justify-between p-3.5 border rounded-xl transition ${
                    isLocked ? 'bg-gray-50/70 border-amber-100/60' : 'bg-gray-50 border-gray-100 hover:bg-gray-100/30'
                  }`}>
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <label className={`text-xs font-semibold text-gray-800 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`} htmlFor={key}>
                          {label}
                        </label>
                        {isLocked && (
                          <span className="text-[8px] bg-amber-50 text-amber-600 font-bold border border-amber-200/50 px-1 rounded uppercase tracking-wider">
                            Enforced
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-450 leading-relaxed">{desc}</p>
                    </div>
                    <input
                      id={key}
                      type="checkbox"
                      checked={isLocked ? true : ((preferences as any)[key] ?? true)}
                      disabled={isLocked}
                      onChange={() => handleTogglePreference(key as any)}
                      className={`w-4 h-4 rounded border-gray-300 focus:ring-indigo-500 shrink-0 mt-0.5 ${
                        isLocked 
                          ? 'text-amber-500 cursor-not-allowed bg-amber-50 border-amber-200 opacity-80' 
                          : 'text-indigo-650 cursor-pointer'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>

        {/* Registered Devices Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="p-2 bg-indigo-50 rounded-xl"><User size={17} className="text-indigo-600" /></div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Registered Push Devices</h2>
              <p className="text-xs text-gray-400">Manage browsers authorized to receive push notifications on this account</p>
            </div>
          </div>
          <div className="p-6">
            {devices.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No devices registered for push alerts. Enable push notifications in support chat to register this browser.</p>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-semibold text-gray-800 truncate" title={device.user_agent || 'Unknown Device'}>
                        {device.user_agent || 'Unknown Browser/Device'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Registered: {new Date(device.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDevice(device.id)}
                      className="text-xs font-semibold text-red-650 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-205/50 px-2.5 py-1.5 rounded-lg transition"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
