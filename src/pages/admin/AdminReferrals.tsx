import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function AdminReferrals() {
  const [level1, setLevel1] = useState('5');
  const [level2, setLevel2] = useState('2');
  const [level3, setLevel3] = useState('1');
  const [enabled, setEnabled] = useState('true');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['referral_level1_percent', 'referral_level2_percent', 'referral_level3_percent', 'referral_enabled']);
    if (!error && data) {
      data.forEach((s: any) => {
        if (s.key === 'referral_level1_percent') setLevel1(s.value);
        if (s.key === 'referral_level2_percent') setLevel2(s.value);
        if (s.key === 'referral_level3_percent') setLevel3(s.value);
        if (s.key === 'referral_enabled') setEnabled(s.value);
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = [
        { key: 'referral_level1_percent', value: level1 },
        { key: 'referral_level2_percent', value: level2 },
        { key: 'referral_level3_percent', value: level3 },
        { key: 'referral_enabled', value: enabled },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: u.value, updated_at: new Date().toISOString() })
          .eq('key', u.key);
        if (error) throw error;
      }
      toast.success('Referral settings updated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Referral Program</h1>
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Level 1 Commission (%)</label>
            <input type="number" step="0.5" value={level1} onChange={(e) => setLevel1(e.target.value)} className="w-full border rounded-xl px-4 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Level 2 Commission (%)</label>
            <input type="number" step="0.5" value={level2} onChange={(e) => setLevel2(e.target.value)} className="w-full border rounded-xl px-4 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Level 3 Commission (%)</label>
            <input type="number" step="0.5" value={level3} onChange={(e) => setLevel3(e.target.value)} className="w-full border rounded-xl px-4 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Enable Referral Program</label>
            <select value={enabled} onChange={(e) => setEnabled(e.target.value)} className="w-full border rounded-xl px-4 py-2">
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-xl flex items-center gap-2"><Save size={18} /> {saving ? 'Saving...' : 'Save'}</button>
        </form>
      </div>
    </div>
  );
}