import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Save, Wallet, DollarSign, Bell, Gift, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { notifyUsers } from '../../lib/notify';

interface DepositMethod {
  currency: string;
  network: string;
  address: string;
  min: number;
}

export default function AdminSettings() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const handleSendInactivityReminders = async () => {
    setSendingReminders(true);
    try {
      const graceHours = parseInt(inactivityHours) || 24;
      const warningWindowStartMs = (graceHours - 48) * 60 * 60 * 1000;
      const warningWindowEndMs = graceHours * 60 * 65 * 1000;

      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, created_at, wallet_balance, is_admin'),
        supabase.from('orders').select('user_id')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      const usersList = profilesRes.data || [];
      const usersWithOrders = new Set((ordersRes.data || []).map(o => o.user_id));

      const now = Date.now();
      const targetUsers = usersList.filter(u => {
        if (u.is_admin) return false;
        const hasOrders = usersWithOrders.has(u.id);
        const hasBalance = (u.wallet_balance || 0) > 0;
        if (hasOrders || hasBalance) return false;

        const ageMs = now - new Date(u.created_at).getTime();
        return ageMs >= warningWindowStartMs && ageMs < warningWindowEndMs;
      });

      if (targetUsers.length === 0) {
        toast.info('No users currently in the 48-hour restriction warning window.');
        return;
      }

      const userIds = targetUsers.map(u => u.id);
      await notifyUsers(userIds, {
        title: 'Action Required: Account restriction warning',
        message: 'Your account is approaching restriction due to inactivity. Please top up your wallet or start an investment to keep full access.',
        type: 'warning',
        link: '/app/wallet'
      });

      toast.success(`Successfully dispatched grace warnings to ${targetUsers.length} users.`);
    } catch (err: any) {
      toast.error('Failed to dispatch reminders: ' + err.message);
    } finally {
      setSendingReminders(false);
    }
  };

  // Deposit methods
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([
    { currency: 'USDT', network: 'BEP20 (BSC)', address: '', min: 10 }
  ]);

  // Bonus settings
  const [bonusPercent, setBonusPercent] = useState('10');
  const [bonusEnabled, setBonusEnabled] = useState('true');

  // Low balance
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState('10');
  const [lowBalanceEnabled, setLowBalanceEnabled] = useState('true');

  // Inactivity settings
  const [inactivityHours, setInactivityHours] = useState('24');
  const [inactivityRestrictionType, setInactivityRestrictionType] = useState('wallet_only');

  // Notification defaults
  const [emailNotif, setEmailNotif] = useState({ deposit: true, withdrawal: true, payout: true, promo: true, low_balance: true });
  const [pushNotif, setPushNotif] = useState({ deposit: true, withdrawal: true, payout: true, promo: true, low_balance: true });

  // Notification Locks (Enforcements)
  const [lockedNotif, setLockedNotif] = useState<Record<string, boolean>>({
    email_info: false,
    email_success: false,
    email_warning: true,
    email_alert: true,
    push_info: false,
    push_success: false,
    push_warning: true,
    push_alert: true,
  });

  // Property scroll speed
  const [scrollSpeed, setScrollSpeed] = useState('3');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');
    if (error) {
      toast.error('Failed to load settings');
    } else {
      data?.forEach((s: any) => {
        if (s.key === 'deposit_methods') {
          try { setDepositMethods(JSON.parse(s.value)); } catch (err) { console.warn('Failed parsing deposit methods', err); }
        }
        if (s.key === 'first_deposit_bonus_percent') setBonusPercent(s.value);
        if (s.key === 'first_deposit_bonus_enabled') setBonusEnabled(s.value);
        if (s.key === 'low_balance_threshold') setLowBalanceThreshold(s.value);
        if (s.key === 'low_balance_enabled') setLowBalanceEnabled(s.value);
        if (s.key === 'inactivity_hours') setInactivityHours(s.value);
        if (s.key === 'inactivity_restriction_type') setInactivityRestrictionType(s.value);
        if (s.key === 'email_notifications') {
          try { setEmailNotif(JSON.parse(s.value)); } catch (err) { console.warn('Failed parsing email notif settings', err); }
        }
        if (s.key === 'push_notifications') {
          try { setPushNotif(JSON.parse(s.value)); } catch (err) { console.warn('Failed parsing push notif settings', err); }
        }
        if (s.key === 'locked_notifications') {
          try { setLockedNotif(JSON.parse(s.value)); } catch (err) { console.warn('Failed parsing locked notifications settings', err); }
        }
        if (s.key === 'property_scroll_speed') setScrollSpeed(s.value);
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = [
        { key: 'deposit_methods', value: JSON.stringify(depositMethods) },
        { key: 'first_deposit_bonus_percent', value: bonusPercent },
        { key: 'first_deposit_bonus_enabled', value: bonusEnabled },
        { key: 'low_balance_threshold', value: lowBalanceThreshold },
        { key: 'low_balance_enabled', value: lowBalanceEnabled },
        { key: 'inactivity_hours', value: inactivityHours },
        { key: 'inactivity_restriction_type', value: inactivityRestrictionType },
        { key: 'email_notifications', value: JSON.stringify(emailNotif) },
        { key: 'push_notifications', value: JSON.stringify(pushNotif) },
        { key: 'locked_notifications', value: JSON.stringify(lockedNotif) },
        { key: 'property_scroll_speed', value: scrollSpeed },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      
      // Log the admin audit trail
      if (profile?.id) {
        await supabase.from('admin_actions').insert({
          admin_id: profile.id,
          action: 'update_settings',
          target_table: 'settings',
          target_id: 'locked_notifications',
          details: {
            changes: {
              locked_notifications: lockedNotif
            }
          }
        });
      }

      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Deposit methods management
  const addMethod = () => {
    setDepositMethods([...depositMethods, { currency: '', network: '', address: '', min: 10 }]);
  };

  const removeMethod = (index: number) => {
    setDepositMethods(depositMethods.filter((_, i) => i !== index));
  };

  const updateMethod = (index: number, field: keyof DepositMethod, value: any) => {
    const updated = [...depositMethods];
    updated[index] = { ...updated[index], [field]: value };
    setDepositMethods(updated);
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
      <form onSubmit={handleSave} className="space-y-6">

        {/* Deposit Methods */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Wallet size={20} className="text-brand" /> Deposit Methods</h2>
          {depositMethods.map((method, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-4 mt-4 space-y-3 relative">
              {depositMethods.length > 1 && (
                <button type="button" onClick={() => removeMethod(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Currency</label><input type="text" value={method.currency} onChange={(e) => updateMethod(index, 'currency', e.target.value)} className="w-full border rounded-xl px-4 py-2" placeholder="USDT" required /></div>
                <div><label className="block text-sm font-medium text-gray-700">Network</label><input type="text" value={method.network} onChange={(e) => updateMethod(index, 'network', e.target.value)} className="w-full border rounded-xl px-4 py-2" placeholder="BEP20" required /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Address</label><input type="text" value={method.address} onChange={(e) => updateMethod(index, 'address', e.target.value)} className="w-full border rounded-xl px-4 py-2 font-mono text-sm" placeholder="0x..." required /></div>
              <div><label className="block text-sm font-medium text-gray-700">Min Deposit ($)</label><input type="number" step="0.01" value={method.min} onChange={(e) => updateMethod(index, 'min', parseFloat(e.target.value))} className="w-full border rounded-xl px-4 py-2" required /></div>
            </div>
          ))}
          <button type="button" onClick={addMethod} className="mt-4 text-brand hover:text-brand-dark font-medium flex items-center gap-1">+ Add Method</button>
        </div>

        {/* Bonus */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Gift size={20} className="text-brand" /> First Deposit Bonus</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div><label className="block text-sm font-medium text-gray-700">Bonus (%)</label><input type="number" step="0.5" value={bonusPercent} onChange={(e) => setBonusPercent(e.target.value)} className="w-full border rounded-xl px-4 py-2" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Enabled</label><select value={bonusEnabled} onChange={(e) => setBonusEnabled(e.target.value)} className="w-full border rounded-xl px-4 py-2"><option value="true">Yes</option><option value="false">No</option></select></div>
          </div>
        </div>

        {/* Low Balance */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><DollarSign size={20} className="text-brand" /> Low Balance Warning</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div><label className="block text-sm font-medium text-gray-700">Threshold ($)</label><input type="number" step="0.5" value={lowBalanceThreshold} onChange={(e) => setLowBalanceThreshold(e.target.value)} className="w-full border rounded-xl px-4 py-2" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Enabled</label><select value={lowBalanceEnabled} onChange={(e) => setLowBalanceEnabled(e.target.value)} className="w-full border rounded-xl px-4 py-2"><option value="true">Yes</option><option value="false">No</option></select></div>
          </div>
        </div>

        {/* Inactivity */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><SettingsIcon size={20} className="text-brand" /> Inactivity Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Inactivity Period (Days)</label>
              <input
                type="number"
                min="1"
                value={Math.round(parseInt(inactivityHours) / 24) || 1}
                onChange={(e) => setInactivityHours(String((parseInt(e.target.value) || 1) * 24))}
                className="w-full border rounded-xl px-4 py-2 mt-1 focus:ring-2 focus:ring-brand"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Number of days a user has to make their first investment before restrictions apply.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Restriction Action</label>
              <select
                value={inactivityRestrictionType}
                onChange={(e) => setInactivityRestrictionType(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 mt-1 focus:ring-2 focus:ring-brand"
              >
                <option value="wallet_only">Wallet Only (Redirect to Wallet Page)</option>
                <option value="suspend_withdraw">Suspend Withdrawals</option>
                <option value="suspend_invest">Suspend Investing & Staking</option>
                <option value="suspend_all">Suspend All Actions (Withdrawals, Investing, Staking, Properties)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1 font-medium text-amber-700">Decide which operations are blocked when a user exceeds the inactivity period.</p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t flex justify-end">
            <button
              type="button"
              onClick={handleSendInactivityReminders}
              disabled={sendingReminders}
              className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-250 text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60 shadow-sm"
            >
              Send Inactivity Warning Emails (48h Grace Window)
            </button>
          </div>
        </div>

        {/* User Notification Enforcements (Locks) */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Bell size={20} className="text-brand" /> User Notification Enforcements (Locks)</h2>
          <p className="text-xs text-gray-500 mt-1">
            Specify which notification categories are mandatory (Locked) for all members. Locked notifications are forced to be <strong>ON</strong> and cannot be disabled by users in their settings. Flexible notifications can be toggled by members at will.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Email Locks */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 border-b pb-2 flex items-center justify-between">
                <span>Email Category</span>
                <span className="text-xs font-semibold text-gray-400">Lock Switch</span>
              </h3>
              {[
                { key: 'email_info', label: 'Support & Announcements (Info)' },
                { key: 'email_success', label: 'Successful Operations (Success)' },
                { key: 'email_warning', label: 'Account Safeguards (Warning)' },
                { key: 'email_alert', label: 'Critical Account Events (Alert)' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lockedNotif[key] || false}
                      onChange={(e) => setLockedNotif({ ...lockedNotif, [key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand/30 dark:bg-gray-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    <span className="ml-2 text-xs font-semibold text-gray-600 min-w-[55px]">
                      {lockedNotif[key] ? 'Locked' : 'Flexible'}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            {/* Push/In-App Locks */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 border-b pb-2 flex items-center justify-between">
                <span>Push & In-App Category</span>
                <span className="text-xs font-semibold text-gray-400">Lock Switch</span>
              </h3>
              {[
                { key: 'push_info', label: 'Live Chat & Messaging (Info)' },
                { key: 'push_success', label: 'Transaction Notifications (Success)' },
                { key: 'push_warning', label: 'Security & Auth Notices (Warning)' },
                { key: 'push_alert', label: 'Action-Required Warnings (Alert)' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lockedNotif[key] || false}
                      onChange={(e) => setLockedNotif({ ...lockedNotif, [key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand/30 dark:bg-gray-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    <span className="ml-2 text-xs font-semibold text-gray-600 min-w-[55px]">
                      {lockedNotif[key] ? 'Locked' : 'Flexible'}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Property Gallery Auto-Scroll */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><SettingsIcon size={20} className="text-brand" /> Property Gallery Auto-Scroll</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Auto-Scroll Interval (Seconds)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 mt-1 focus:ring-2 focus:ring-brand"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Number of seconds each property listing image remains visible before sliding.</p>
            </div>
          </div>
        </div>

        {/* Notification Defaults */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Bell size={20} className="text-brand" /> Notification Defaults</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <p className="font-medium text-sm text-gray-700">Email</p>
              {Object.entries(emailNotif).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2 text-sm mt-1">
                  <input type="checkbox" checked={val} onChange={(e) => setEmailNotif({ ...emailNotif, [key]: e.target.checked })} />
                  {key.replace('_', ' ').charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>
            <div>
              <p className="font-medium text-sm text-gray-700">Push</p>
              {Object.entries(pushNotif).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2 text-sm mt-1">
                  <input type="checkbox" checked={val} onChange={(e) => setPushNotif({ ...pushNotif, [key]: e.target.checked })} />
                  {key.replace('_', ' ').charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="bg-brand hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition disabled:opacity-70">
          <Save size={18} /> {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </form>
    </div>
  );
}