import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Copy, Users, TrendingUp, Gift, ArrowUp, Check, Share2, LinkIcon } from 'lucide-react';

export default function Referral() {
  const { profile, refreshProfile } = useAuthStore();
  const [referralLink, setReferralLink] = useState('');
  const [downlines, setDownlines] = useState<any[]>([]);
  const [upline, setUpline] = useState<any>(null);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // The referral link was rendering as ".../signup?ref=null" for any profile
  // whose referral_code was never set (e.g. older accounts). A null code also
  // breaks the signup lookup, so the link wouldn't work. Here we guarantee a
  // permanent, working permalink: if the code is missing we generate one and
  // persist it to the profile so it stays stable across sessions.
  const ensureReferralCode = async () => {
    if (!profile) return;
    let code = profile.referral_code;
    if (!code) {
      code = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', profile.id);
      if (error) {
        console.error('Failed to persist referral code:', error);
      } else {
        // Keep the in-memory profile in sync so other pages see the new code.
        await refreshProfile();
      }
    }
    setReferralLink(`${window.location.origin}/signup?ref=${code}`);
  };

  const fetchReferralData = async () => {
    if (!profile) return;
    if (profile.referred_by) {
      const { data, error } = await supabase.from('profiles').select('id, name, email, referral_code').eq('id', profile.referred_by).single();
      if (!error) setUpline(data);
    }
    const { data: refs, error: refsErr } = await supabase
      .from('referrals').select('*, referee:referee_id(id, name, email, created_at)')
      .eq('referrer_id', profile.id).order('created_at', { ascending: false });
    if (!refsErr) setDownlines(refs || []);
    const { data: commissions, error: commErr } = await supabase
      .from('referral_commissions').select('amount').eq('user_id', profile.id).is('paid_at', null);
    if (!commErr) setTotalCommission(commissions?.reduce((s, c) => s + c.amount, 0) || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) {
      ensureReferralCode();
      fetchReferralData();
    }
  }, [profile]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join RPM (Rema Profit Machine)', text: 'Start investing and earning daily returns!', url: referralLink });
    } else { copyLink(); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Program</h1>
        <p className="text-gray-500 text-sm mt-0.5">Share your link, grow your network, earn commissions.</p>
      </div>

      {/* Upline */}
      {upline && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
            {(upline.name || upline.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">Referred by</p>
            <p className="font-semibold text-blue-900">{upline.name || upline.email} <span className="font-normal text-blue-500">(Code: {upline.referral_code})</span></p>
          </div>
          <ArrowUp size={16} className="text-blue-500 ml-auto" />
        </div>
      )}

      {/* Referral Link Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon size={16} className="text-brand" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Referral Link</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">Share this link and earn commissions when your referrals invest.</p>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-2 mb-4">
            <code className="text-xs text-gray-300 break-all flex-1 font-mono leading-relaxed">{referralLink}</code>
            <button onClick={copyLink} className="shrink-0 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition">
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-gray-400" />}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-brand/30">
              {copied ? <Check size={15} /> : <Copy size={15} />} Copy Link
            </button>
            <button onClick={shareLink} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition border border-white/10">
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Users      size={22} className="text-brand"         />, label: 'Total Downlines',    value: String(downlines.length),                                    bg: 'bg-brand/5 text-brand'           },
          { icon: <TrendingUp size={22} className="text-blue-600"      />, label: 'Pending Commission', value: fmt(totalCommission),                                        bg: 'bg-blue-50 text-blue-600'        },
          { icon: <Gift       size={22} className="text-amber-600"     />, label: 'Paid Downlines',     value: String(downlines.filter(r => r.status === 'paid').length),   bg: 'bg-amber-50 text-amber-600'      },
        ].map(({ icon, label, value, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
        <h3 className="font-semibold text-emerald-900 mb-3 text-sm">How Referrals Work</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', text: 'Share your unique referral link' },
            { step: '2', text: 'Your contact signs up & invests' },
            { step: '3', text: 'You earn a commission automatically' },
          ].map(({ step, text }) => (
            <div key={step} className="text-center">
              <div className="w-8 h-8 bg-emerald-600 text-white text-sm font-bold rounded-full flex items-center justify-center mx-auto mb-2">{step}</div>
              <p className="text-xs text-emerald-800">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Downlines Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={17} className="text-brand" />
          <h2 className="font-semibold text-gray-900">Your Downlines ({downlines.length})</h2>
        </div>
        {downlines.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No downlines yet. Start sharing your link!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['#', 'Name', 'Email', 'Level', 'Status', 'Joined'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {downlines.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand/10 rounded-full flex items-center justify-center text-xs font-bold text-brand">
                          {(r.referee?.name || r.referee?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{r.referee?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400">{r.referee?.email || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">Lv. {r.level}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
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
