import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Copy, Users, TrendingUp, Gift, User, ArrowUp, ArrowDown } from 'lucide-react';

export default function Referral() {
  const { profile } = useAuthStore();
  const [referralLink, setReferralLink] = useState('');
  const [downlines, setDownlines] = useState<any[]>([]);
  const [upline, setUpline] = useState<any>(null);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile) {
      setReferralLink(`${window.location.origin}/signup?ref=${profile.referral_code}`);
      fetchReferralData();
    }
  }, [profile]);

  const fetchReferralData = async () => {
    if (!profile) return;

    // Fetch upline (who referred this user)
    if (profile.referred_by) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, referral_code')
        .eq('id', profile.referred_by)
        .single();
      if (!error) setUpline(data);
    }

    // Fetch downlines (users referred by this user)
    const { data: refs, error: refsErr } = await supabase
      .from('referrals')
      .select('*, referee:referee_id(id, name, email, created_at)')
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false });
    if (!refsErr) setDownlines(refs || []);

    // Fetch pending commissions
    const { data: commissions, error: commErr } = await supabase
      .from('referral_commissions')
      .select('amount')
      .eq('user_id', profile.id)
      .eq('paid_at', 'null');
    if (!commErr) {
      const total = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;
      setTotalCommission(total);
    }

    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) return <div className="p-8 text-center">Loading referral data...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">Referral Program</h1>

      {/* Upline info */}
      {upline && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <ArrowUp size={20} className="text-blue-600" />
          <span className="text-sm">Your upline: <strong>{upline.name || upline.email}</strong> (Code: {upline.referral_code})</span>
        </div>
      )}

      {/* Referral Link */}
      <div className="bg-white rounded-2xl shadow-lg border p-6">
        <h2 className="text-lg font-semibold mb-2">Your Referral Link</h2>
        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl">
          <code className="text-sm break-all flex-1">{referralLink}</code>
          <button onClick={copyLink} className="p-2 hover:bg-gray-200 rounded">
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Share this link and earn commissions when they invest.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <Users size={24} className="text-brand" />
          <div><p className="text-sm text-gray-500">Downlines</p><p className="text-xl font-bold">{downlines.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <TrendingUp size={24} className="text-blue-500" />
          <div><p className="text-sm text-gray-500">Pending Commission</p><p className="text-xl font-bold">{formatCurrency(totalCommission)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <Gift size={24} className="text-yellow-500" />
          <div><p className="text-sm text-gray-500">Active Downlines</p><p className="text-xl font-bold">{downlines.filter(r => r.status === 'paid').length}</p></div>
        </div>
      </div>

      {/* Downlines Table */}
      <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b flex items-center gap-2"><ArrowDown size={18} /> Your Downlines</h2>
        {downlines.length === 0 ? (
          <p className="p-4 text-gray-500">No downlines yet. Share your referral link!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Level</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {downlines.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.referee?.name || 'Unknown'}</td>
                    <td className="p-3">{r.referee?.email || '—'}</td>
                    <td className="p-3">Level {r.level}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}