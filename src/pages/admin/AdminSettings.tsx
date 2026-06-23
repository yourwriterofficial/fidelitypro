import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Save, Wallet, DollarSign, Bell, Gift, Settings as SettingsIcon } from 'lucide-react';

interface DepositMethod {
  currency: string;
  network: string;
  address: string;
  min: number;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Inactivity hours
  const [inactivityHours, setInactivityHours] = useState('24');

  // Notification defaults
  const [emailNotif, setEmailNotif] = useState({ deposit: true, withdrawal: true, payout: true, promo: true, low_balance: true });
  const [pushNotif, setPushNotif] = useState({ deposit: true, withdrawal: true, payout: true, promo: true, low_balance: true });

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
          try { setDepositMethods(JSON.parse(s.value)); } catch {}
        }
        if (s.key === 'first_deposit_bonus_percent') setBonusPercent(s.value);
        if (s.key === 'first_deposit_bonus_enabled') setBonusEnabled(s.value);
        if (s.key === 'low_balance_threshold') setLowBalanceThreshold(s.value);
        if (s.key === 'low_balance_enabled') setLowBalanceEnabled(s.value);
        if (s.key === 'inactivity_hours') setInactivityHours(s.value);
        if (s.key === 'email_notifications') {
          try { setEmailNotif(JSON.parse(s.value)); } catch {}
        }
        if (s.key === 'push_notifications') {
          try { setPushNotif(JSON.parse(s.value)); } catch {}
        }
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
        { key: 'email_notifications', value: JSON.stringify(emailNotif) },
        { key: 'push_notifications', value: JSON.stringify(pushNotif) },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: u.value, updated_at: new Date().toISOString() })
          .eq('key', u.key);
        if (error) throw error;
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
      <h1 className="text-3xl font-bold">Settings</h1>
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
          <div className="mt-4"><label className="block text-sm font-medium text-gray-700">Inactivity Hours</label><input type="number" min="1" value={inactivityHours} onChange={(e) => setInactivityHours(e.target.value)} className="w-full border rounded-xl px-4 py-2" /></div>
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