import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import { notifyAdmins, notifyAdminsWithEmail } from '../lib/notify';
import { toast } from 'sonner';
import {
  Wallet, ArrowDown, ArrowUp, Copy, Check, Send, RefreshCw,
  History, AlertCircle, TrendingUp, DollarSign, ShieldCheck, Info,
} from 'lucide-react';

interface DepositMethod { currency: string; network: string; address: string; min: number; }
interface Transaction {
  id: string; type: string; amount: number; description: string;
  status: string; created_at: string; is_admin_action?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; positive: boolean }> = {
  deposit:    { label: 'Deposit',          icon: <ArrowDown   size={14} />, positive: true  },
  withdrawal: { label: 'Withdrawal',       icon: <ArrowUp     size={14} />, positive: false },
  investment: { label: 'Investment',       icon: <TrendingUp  size={14} />, positive: false },
  return:     { label: 'Daily Return',     icon: <DollarSign  size={14} />, positive: true  },
  admin:      { label: 'Admin Adjustment', icon: <ShieldCheck size={14} />, positive: true  },
};

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected:  'bg-red-50 text-red-700 border-red-100',
  failed:    'bg-red-50 text-red-700 border-red-100',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-100',
};

export default function WalletPage() {
  const { profile, refreshProfile } = useAuthStore();
  const { withdrawRestricted } = useAccountRestriction();
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'deposit_methods').single();
    if (error) { toast.error('Deposit methods not configured. Contact support.'); return; }
    try {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setDepositMethods(parsed);
        setSelectedCurrency(parsed[0].currency);
      } else { toast.error('No deposit methods configured.'); }
    } catch { toast.error('Invalid deposit methods format.'); }
  };

  const fetchTransactionHistory = async () => {
    if (!profile) return;
    setHistoryLoading(true);
    try {
      const { data: txs, error: txsErr } = await supabase
        .from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
      if (txsErr) throw txsErr;
      const { data: withdrawals } = await supabase
        .from('withdrawals').select('id, amount, address, status, created_at').eq('user_id', profile.id);
      const { data: deposits } = await supabase
        .from('deposits').select('id, amount, status, created_at').eq('user_id', profile.id);
      const all: Transaction[] = [];
      txs?.forEach(t => all.push({
        id: t.id, type: t.type, amount: t.amount,
        description: t.description || t.type, status: t.status || 'completed',
        created_at: t.created_at,
        is_admin_action: t.type === 'admin' || (t.description && t.description.toLowerCase().includes('admin')),
      }));
      withdrawals?.forEach(w => {
        if (!['completed','approved','rejected'].includes(w.status)) {
          all.push({ id: w.id, type: 'withdrawal', amount: -w.amount,
            description: `Withdrawal to ${w.address.substring(0, 10)}...`,
            status: w.status, created_at: w.created_at, is_admin_action: false });
        }
      });
      deposits?.forEach(d => {
        if (d.status !== 'confirmed') {
          all.push({ id: d.id, type: 'deposit', amount: d.amount,
            description: 'Pending deposit', status: d.status, created_at: d.created_at, is_admin_action: false });
        }
      });
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(all);
    } catch (err) {
      console.error('Failed to fetch transaction history:', err);
      toast.error('Could not load transaction history');
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    fetchSettings();
    fetchTransactionHistory();
  }, [profile?.id]);

  const handleDepositConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const method = depositMethods.find(m => m.currency === selectedCurrency);
    if (!method) { toast.error('Selected currency not found'); return; }
    if (amount < method.min) { toast.error(`Minimum deposit for ${method.currency} is $${method.min}`); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('deposits').insert({
        user_id: profile.id, amount, transaction_hash: selectedCurrency, status: 'pending',
      });
      if (error) throw error;
      toast.success('Deposit submitted! Your wallet will be credited once your deposit is confirmed.');
      setDepositAmount('');
      await fetchTransactionHistory();
      await refreshProfile();

      // Trigger admin notifications
      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      const userName = profile.name || profile.email || 'A user';
      
      notifyAdmins({
        title: 'New Deposit Request',
        message: `${userName} submitted a deposit request of ${formattedAmount} via ${selectedCurrency}.`,
        type: 'alert',
        link: '/admin/deposits'
      });

      notifyAdminsWithEmail(
        `[RPM] Deposit Alert: ${userName} - ${formattedAmount}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-bottom: 20px;">New Deposit Request</h2>
            <p><strong>User:</strong> ${profile.name} (${profile.email})</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Method:</strong> ${selectedCurrency}</p>
            <p style="margin-top: 24px;">
              <a href="${window.location.origin}/admin/deposits" 
                 style="background: #10b981; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Review Deposit
              </a>
            </p>
          </div>
        `
      );
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!profile.can_withdraw || withdrawRestricted) { toast.error('Withdrawals are disabled for your account'); return; }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > (profile.wallet_balance || 0)) { toast.error('Insufficient balance'); return; }
    if (!withdrawAddress) { toast.error('Enter a withdrawal address'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('withdrawals').insert({
        user_id: profile.id, amount, address: withdrawAddress, status: 'pending',
      });
      if (error) throw error;
      toast.success('Withdrawal request submitted!');
      setWithdrawAmount(''); setWithdrawAddress('');
      await fetchTransactionHistory(); await refreshProfile();

      // Trigger admin notifications
      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      const userName = profile.name || profile.email || 'A user';
      
      notifyAdmins({
        title: 'New Withdrawal Request',
        message: `${userName} requested a withdrawal of ${formattedAmount}.`,
        type: 'alert',
        link: '/admin/withdrawals'
      });

      notifyAdminsWithEmail(
        `[RPM] Withdrawal Alert: ${userName} - ${formattedAmount}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-bottom: 20px;">New Withdrawal Request</h2>
            <p><strong>User:</strong> ${profile.name} (${profile.email})</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Address:</strong> ${withdrawAddress}</p>
            <p style="margin-top: 24px;">
              <a href="${window.location.origin}/admin/withdrawals" 
                 style="background: #ef4444; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Review Withdrawal
              </a>
            </p>
          </div>
        `
      );
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const copyAddress = () => {
    const method = depositMethods.find(m => m.currency === selectedCurrency);
    if (!method?.address) return;
    navigator.clipboard.writeText(method.address);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied!');
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
  const selectedMethod = depositMethods.find(m => m.currency === selectedCurrency);
  const pendingDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage deposits, withdrawals, and transaction history.</p>
      </div>

      {/* Balance Hero */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-brand/20 rounded-2xl p-6 overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand/10 rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-sm text-gray-400 uppercase tracking-wider font-medium">Available Balance</p>
          <p className="text-5xl font-extrabold mt-2 tabular-nums tracking-tight">
            {fmt(profile?.wallet_balance || 0)}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setTab('deposit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'deposit' ? 'bg-brand text-white shadow-lg shadow-brand/30' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <ArrowDown size={15} /> Deposit
            </button>
            <button
              onClick={() => setTab('withdraw')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'withdraw' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <ArrowUp size={15} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Deposit / Withdraw Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          {(['deposit', 'withdraw'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                tab === t
                  ? t === 'deposit' ? 'text-brand border-b-2 border-brand' : 'text-red-600 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'deposit' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── DEPOSIT ── */}
          {tab === 'deposit' && (
            <div className="space-y-5">
              {depositMethods.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                  <AlertCircle size={18} className="shrink-0" />
                  No deposit methods configured. Contact support.
                </div>
              ) : (
                <>
                  {/* Step 1 – Currency */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-brand text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                      <label className="text-sm font-semibold text-gray-700">Select Currency</label>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {depositMethods.map(m => (
                        <button
                          key={m.currency}
                          onClick={() => setSelectedCurrency(m.currency)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                            selectedCurrency === m.currency
                              ? 'bg-brand text-white border-brand shadow-sm'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-brand hover:text-brand'
                          }`}
                        >
                          {m.currency} <span className="text-xs opacity-70">({m.network})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2 – Address */}
                  {selectedMethod && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 bg-brand text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
                        <label className="text-sm font-semibold text-gray-700">
                          Your Personal {selectedMethod.currency} Deposit Address
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {profile?.name ? `${profile.name.split(' ')[0]}, this` : 'This'} is your personal{' '}
                        {selectedMethod.currency} wallet address — send funds here any time to top up your account balance.
                      </p>
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs sm:text-sm break-all font-mono text-gray-800 flex-1">{selectedMethod.address}</code>
                          <button
                            onClick={copyAddress}
                            className="shrink-0 p-2.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition"
                          >
                            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-gray-500" />}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                          <span><strong className="text-gray-700">Network:</strong> {selectedMethod.network}</span>
                          <span><strong className="text-gray-700">Min Deposit:</strong> ${selectedMethod.min}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        Send only <strong>{selectedMethod.currency}</strong> to this address. Wrong asset = permanent loss.
                      </div>
                    </div>
                  )}

                  {/* Step 3 – Confirm */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-brand text-white text-xs font-bold rounded-full flex items-center justify-center">3</span>
                      <label className="text-sm font-semibold text-gray-700">Confirm Amount Sent</label>
                    </div>
                    <form onSubmit={handleDepositConfirm} className="flex gap-2">
                      <input
                        type="number" step="0.01" min={selectedMethod?.min || 0}
                        value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                        placeholder={`Amount in USD (min $${selectedMethod?.min || 0})`}
                        required
                      />
                      <button
                        type="submit" disabled={loading}
                        className="bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold transition shadow-sm hover:shadow-md disabled:opacity-60"
                      >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                        Confirm
                      </button>
                    </form>
                  </div>

                  {/* Pending deposit — spinning bar until the deposit is confirmed */}
                  {pendingDeposits.map(d => (
                    <div key={d.id} className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                      <div className="flex items-center gap-3">
                        <RefreshCw size={18} className="text-brand animate-spin shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            Deposit of {fmt(d.amount)} pending confirmation
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Your wallet will be credited once your deposit is confirmed.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-brand/10">
                        <div className="h-full w-1/3 animate-indeterminate rounded-full bg-brand" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── WITHDRAW ── */}
          {tab === 'withdraw' && (
            profile && (!profile.can_withdraw || withdrawRestricted) ? (
              <div className="py-8 px-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertCircle size={24} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Withdrawals Suspended</h3>
                <p className="text-gray-500 text-sm mt-2">
                  {withdrawRestricted
                    ? 'Withdrawals are suspended due to account inactivity. Please top up your wallet or make an investment to restore access.'
                    : (profile.restriction_reason || 'Contact support to unlock withdrawals.')
                  }
                </p>
                {profile.fee_required > 0 && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                    A deposit of <strong>${profile.fee_required}</strong> is required to unlock.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm">
                  <Wallet size={18} className="text-brand shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Available to withdraw</p>
                    <p className="font-bold text-gray-900 text-base tabular-nums">{fmt(profile?.wallet_balance || 0)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder="100.00" required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(profile?.wallet_balance || ''))}
                    className="mt-1.5 text-xs text-brand font-medium hover:underline"
                  >
                    Use max
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Wallet Address</label>
                  <input
                    type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                    placeholder="Your crypto address (e.g. USDT TRC20)" required
                  />
                </div>
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  Double-check your address. Incorrect addresses result in permanent loss of funds.
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3.5 rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                  Request Withdrawal
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <History size={18} className="text-brand" /> Transaction History
          </h2>
          <button onClick={fetchTransactionHistory} className="p-1.5 text-gray-400 hover:text-brand transition" title="Refresh">
            <RefreshCw size={15} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {historyLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-9 h-9 bg-gray-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <History size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No transactions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map(t => {
              const cfg = TYPE_CONFIG[t.type] || { label: t.type, icon: <DollarSign size={14} />, positive: t.amount > 0 };
              const isPositive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
                      {t.is_admin_action && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : '-'}{fmt(t.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[t.status] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
