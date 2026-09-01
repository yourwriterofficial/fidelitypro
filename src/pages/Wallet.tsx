import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import { notifyAdmins, notifyAdminsWithEmail } from '../lib/notify';
import { toast } from 'sonner';
import {
  Wallet, ArrowDown, ArrowUp, Copy, Check, Send, RefreshCw,
  History, AlertCircle, TrendingUp, DollarSign, ShieldCheck, Info,
  ArrowRightLeft, Building, Upload, Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';

interface DepositMethod { currency: string; network: string; address: string; min: number; }
interface Transaction {
  id: string; type: string; amount: number; description: string;
  status: string; created_at: string; is_admin_action?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; positive: boolean }> = {
  deposit:    { label: 'Deposit',          icon: <ArrowDown   size={14} />, positive: true  },
  withdrawal: { label: 'Withdrawal',       icon: <ArrowUp     size={14} />, positive: false },
  investment: { label: 'ROI Plan',         icon: <TrendingUp  size={14} />, positive: false },
  property:   { label: 'Property Equity',  icon: <Building    size={14} />, positive: false },
  return:     { label: 'Daily Yield',      icon: <DollarSign  size={14} />, positive: true  },
  admin:      { label: 'Settlement Adj.',  icon: <ShieldCheck size={14} />, positive: true  },
};

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-emerald-50 text-brand border-emerald-200',
  confirmed: 'bg-emerald-50 text-brand border-emerald-200',
  approved:  'bg-emerald-50 text-brand border-emerald-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
  failed:    'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

const WITHDRAWAL_NETWORKS = [
  { id: 'USDT_TRC20', label: 'USDT (TRC20)', desc: 'Tron Network • 0% Fee • ~5 Mins', placeholder: 'Enter USDT TRC20 address (starts with T...)' },
  { id: 'BTC',        label: 'BTC (Bitcoin)',  desc: 'Bitcoin Mainnet • ~30 Mins',        placeholder: 'Enter BTC address (starts with 1, 3, or bc1...)' },
  { id: 'USDT_ERC20', label: 'USDT (ERC20)', desc: 'Ethereum Network • ~15 Mins',       placeholder: 'Enter USDT ERC20 address (starts with 0x...)' },
];

export default function WalletPage() {
  const { profile, refreshProfile } = useAuthStore();
  const { withdrawRestricted } = useAccountRestriction();
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [depositConfirmedCheck, setDepositConfirmedCheck] = useState(false);

  // Withdrawal State
  const [withdrawNetwork, setWithdrawNetwork] = useState('USDT_TRC20');
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

  const handleProofUpload = async (file: File) => {
    if (!profile?.id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `deposit-proofs/${profile.id}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, { upsert: true });

      if (error) {
        // Fallback to base64 preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setProofUrl(reader.result as string);
          toast.success('Deposit screenshot attached!');
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(data.path);

      setProofUrl(publicUrlData.publicUrl);
      toast.success('Deposit screenshot uploaded!');
    } catch (err: any) {
      console.error('Proof upload error:', err);
      toast.error('Could not upload image');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleDepositConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const method = depositMethods.find(m => m.currency === selectedCurrency);
    if (!method) { toast.error('Selected currency not found'); return; }
    if (amount < method.min) { toast.error(`Minimum deposit for ${method.currency} is $${method.min}`); return; }
    if (!proofUrl) {
      toast.error('Please upload your deposit transfer screenshot / payment proof before submitting.');
      return;
    }
    if (!depositConfirmedCheck) {
      toast.error('Please confirm that you have transferred the funds');
      return;
    }

    setLoading(true);
    try {
      const fullMethodTag = `${selectedCurrency} (${method.network})`;
      const { error } = await supabase.from('deposits').insert({
        user_id: profile.id,
        amount,
        transaction_hash: fullMethodTag,
        proof_url: proofUrl,
        status: 'pending',
      });
      if (error) throw error;

      toast.success('Deposit proof submitted! Treasury compliance will credit your balance upon receipt verification.');
      setDepositAmount('');
      setProofUrl('');
      setDepositConfirmedCheck(false);

      await fetchTransactionHistory();
      await refreshProfile();

      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      const userName = profile.name || profile.email || 'A user';
      
      // Dispatch in-app and web push notification to admins
      notifyAdmins({
        title: 'New Deposit Request',
        message: `${userName} submitted a deposit of ${formattedAmount} via ${selectedCurrency} with payment proof.`,
        type: 'alert',
        link: '/admin/deposits'
      });

      // Dispatch email notification to admins
      notifyAdminsWithEmail(
        `[RPM] Deposit Alert: ${userName} - ${formattedAmount}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
            <h2 style="color: #00674F; margin-bottom: 16px;">New Deposit Request</h2>
            <p><strong>User:</strong> ${profile.name} (${profile.email})</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Method:</strong> ${selectedCurrency} (${method.network})</p>
            ${proofUrl ? `<p><strong>Proof Screenshot:</strong> <a href="${proofUrl}">View Screenshot Proof</a></p>` : ''}
            <p style="margin-top: 24px;">
              <a href="${window.location.origin}/admin/deposits" 
                 style="background: #00674F; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Review & Credit Deposit
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
    if (!withdrawAddress.trim()) { toast.error('Enter a withdrawal address'); return; }

    setLoading(true);
    try {
      const selectedNet = WITHDRAWAL_NETWORKS.find(n => n.id === withdrawNetwork);
      const networkLabel = selectedNet ? selectedNet.label : withdrawNetwork;
      const formattedAddress = `[${networkLabel}] ${withdrawAddress.trim()}`;

      const { error } = await supabase.from('withdrawals').insert({
        user_id: profile.id,
        amount,
        address: formattedAddress,
        network: withdrawNetwork,
        status: 'pending',
      });
      if (error) throw error;

      toast.success('Withdrawal request dispatched to treasury queue.');
      setWithdrawAmount('');
      setWithdrawAddress('');

      await fetchTransactionHistory();
      await refreshProfile();

      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      const userName = profile.name || profile.email || 'A user';
      
      // Dispatch in-app and web push notification to admins
      notifyAdmins({
        title: 'New Withdrawal Request',
        message: `${userName} requested a withdrawal of ${formattedAmount} to ${networkLabel}.`,
        type: 'alert',
        link: '/admin/withdrawals'
      });

      // Dispatch email notification to admins
      notifyAdminsWithEmail(
        `[RPM] Withdrawal Alert: ${userName} - ${formattedAmount}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">New Withdrawal Request</h2>
            <p><strong>User:</strong> ${profile.name} (${profile.email})</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Network:</strong> ${networkLabel}</p>
            <p><strong>Destination Address:</strong> <code>${withdrawAddress}</code></p>
            <p style="margin-top: 24px;">
              <a href="${window.location.origin}/admin/withdrawals" 
                 style="background: #ef4444; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
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
    toast.success('Address copied to clipboard!');
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
  const selectedMethod = depositMethods.find(m => m.currency === selectedCurrency);
  const pendingDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
  const activeWithdrawNet = WITHDRAWAL_NETWORKS.find(n => n.id === withdrawNetwork) || WITHDRAWAL_NETWORKS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Treasury & Settlement Desk
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Institutional Wallet
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Top up liquid capital, request withdrawals, and inspect full transaction history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/app/p2p"
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition shadow-sm"
          >
            <ArrowRightLeft size={15} /> P2P OTC Desk ($100k+)
          </Link>
        </div>
      </div>

      {/* Balance Hero Card */}
      <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-bold block">Available Liquid Balance</span>
          <p className="text-4xl sm:text-5xl font-extrabold mt-2 tabular-nums text-white tracking-tight">
            {fmt(profile?.wallet_balance || 0)}
          </p>
          <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Real-time USD Liquidity
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setTab('deposit')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm ${
              tab === 'deposit'
                ? 'bg-brand text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
          >
            <ArrowDown size={15} /> Deposit Funds
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm ${
              tab === 'withdraw'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
          >
            <ArrowUp size={15} /> Request Withdrawal
          </button>
        </div>
      </div>

      {/* Deposit / Withdraw Management Panel */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-gray-100">
          {(['deposit', 'withdraw'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                tab === t
                  ? t === 'deposit'
                    ? 'text-brand border-b-2 border-brand bg-brand/5'
                    : 'text-red-600 border-b-2 border-red-500 bg-red-50/30'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t === 'deposit' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
              {t === 'deposit' ? 'Deposit Treasury Top-Up' : 'Request Liquidity Withdrawal'}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8">
          {/* ── DEPOSIT ── */}
          {tab === 'deposit' && (
            <div className="space-y-6">
              {depositMethods.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-700">
                  <AlertCircle size={18} className="shrink-0" />
                  No deposit methods currently configured. Contact support desk.
                </div>
              ) : (
                <>
                  {/* Step 1 – Currency */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">1</span>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Select Deposit Network</label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {depositMethods.map(m => (
                        <button
                          key={m.currency}
                          onClick={() => setSelectedCurrency(m.currency)}
                          className={`p-3 rounded-2xl text-left border transition ${
                            selectedCurrency === m.currency
                              ? 'bg-brand/10 border-brand ring-2 ring-brand/20'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-extrabold text-xs text-gray-900 block">{m.currency}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{m.network}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2 – Address */}
                  {selectedMethod && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">2</span>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          Your Dedicated {selectedMethod.currency} Deposit Address
                        </label>
                      </div>
                      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <code className="text-xs sm:text-sm break-all font-mono text-gray-900 font-bold flex-1">{selectedMethod.address}</code>
                          <button
                            onClick={copyAddress}
                            className="shrink-0 p-3 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition shadow-xs"
                            title="Copy address"
                          >
                            {copied ? <Check size={16} className="text-brand" /> : <Copy size={16} className="text-gray-500" />}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-200/60 pt-3">
                          <span><strong className="text-gray-700">Network:</strong> {selectedMethod.network}</span>
                          <span><strong className="text-gray-700">Min Deposit:</strong> ${selectedMethod.min}</span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/70 p-3.5 rounded-2xl">
                        <Info size={15} className="shrink-0 mt-0.5 text-amber-700" />
                        <span>Send only <strong>{selectedMethod.currency}</strong> over <strong>{selectedMethod.network}</strong>. Sending wrong assets leads to permanent loss.</span>
                      </div>
                    </div>
                  )}

                  {/* Step 3 – Confirm with Proof & Anti-Fraud Notice */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Provide Deposit Verification Evidence</label>
                    </div>

                    {/* Institutional Settlement Notice */}
                    <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-2xl text-xs space-y-2 mb-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold uppercase tracking-wider text-[10px] border border-red-500/30">
                          Compliance Notice
                        </span>
                        <span className="font-bold text-gray-200 text-xs">Settlement Verification</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed text-[11px]">
                        Please complete the transfer from your personal exchange or wallet before submitting. Submitting requests without sending funds is strictly prohibited under AML regulations and results in immediate account termination and permanent blacklisting.
                      </p>
                    </div>

                    <form onSubmit={handleDepositConfirm} className="space-y-4">
                      {/* Amount */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Amount Sent (USD) *
                        </label>
                        <input
                          type="number" step="0.01" min={selectedMethod?.min || 0}
                          value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-brand focus:border-transparent"
                          placeholder={`Amount in USD (min $${selectedMethod?.min || 0})`}
                          required
                        />
                      </div>

                      {/* Deposit Proof Screenshot Upload */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Transfer Receipt / Payment Proof * (Required)
                        </label>
                        <div className={`border-2 border-dashed rounded-2xl p-4 transition text-center ${
                          proofUrl ? 'border-brand bg-brand/5' : 'border-gray-300 bg-gray-50/60 hover:border-brand'
                        }`}>
                          {proofUrl ? (
                            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                                <ImageIcon size={18} className="text-brand shrink-0" />
                                <span className="truncate">Payment proof attached</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setProofUrl('')}
                                className="text-xs text-red-600 font-bold hover:underline shrink-0"
                              >
                                Replace
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block py-3">
                              <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                              <span className="text-xs font-bold text-gray-800 block">
                                {uploadingProof ? 'Uploading Proof...' : 'Upload Transfer Receipt'}
                              </span>
                              <span className="text-[10px] text-gray-400 block mt-1">PNG, JPG, PDF (Max 10MB)</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={e => e.target.files?.[0] && handleProofUpload(e.target.files[0])}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Explicit Confirmation Checkbox */}
                      <div>
                        <label className="flex items-start gap-3 cursor-pointer bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={depositConfirmedCheck}
                            onChange={e => setDepositConfirmedCheck(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                            required
                          />
                          <span>
                            I confirm that I have sent <strong>${depositAmount || '0'} USD</strong> to the designated deposit address and attached the valid transfer receipt.
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit" disabled={loading || !depositConfirmedCheck}
                        className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md transition disabled:opacity-50"
                      >
                        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                        Submit Deposit For Review
                      </button>
                    </form>
                  </div>

                  {/* Pending Deposits Indicator */}
                  {pendingDeposits.map(d => (
                    <div key={d.id} className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
                      <div className="flex items-center gap-3">
                        <RefreshCw size={18} className="text-brand animate-spin shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900">
                            Deposit of {fmt(d.amount)} pending blockchain confirmation
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Wallet will be automatically credited upon block verification.
                          </p>
                        </div>
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
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertCircle size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Withdrawals Suspended</h3>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                  {withdrawRestricted
                    ? 'Withdrawals are suspended due to account inactivity. Please top up your wallet or start a portfolio plan to restore access.'
                    : (profile.restriction_reason || 'Contact support desk to unlock withdrawal routing.')
                  }
                </p>
                {profile.fee_required > 0 && (
                  <p className="mt-3 text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    A deposit of <strong>${profile.fee_required}</strong> is required to unlock.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs">
                  <Wallet size={18} className="text-brand shrink-0" />
                  <div>
                    <span className="text-gray-500 block">Available to Withdraw</span>
                    <span className="font-extrabold text-gray-900 text-sm tabular-nums">{fmt(profile?.wallet_balance || 0)}</span>
                  </div>
                </div>

                {/* Withdrawal Network Selector (USDT TRC20 / BTC / USDT ERC20) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Select Withdrawal Asset & Network *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {WITHDRAWAL_NETWORKS.map(net => (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setWithdrawNetwork(net.id)}
                        className={`p-3.5 rounded-2xl text-left border transition ${
                          withdrawNetwork === net.id
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs block text-gray-900">{net.label}</span>
                          {withdrawNetwork === net.id && <CheckCircle2 size={15} className="text-brand" />}
                        </div>
                        <span className="text-[10px] text-gray-500 block mt-1">{net.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Withdrawal Amount */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Withdrawal Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3.5 border border-gray-300 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder="100.00" required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(profile?.wallet_balance || ''))}
                    className="mt-1.5 text-xs text-brand font-bold hover:underline"
                  >
                    Max Amount ({fmt(profile?.wallet_balance || 0)})
                  </button>
                </div>

                {/* Withdrawal Address */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Destination {activeWithdrawNet.label} Wallet Address
                  </label>
                  <input
                    type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3.5 text-xs font-mono font-medium focus:ring-2 focus:ring-brand focus:border-transparent"
                    placeholder={activeWithdrawNet.placeholder}
                    required
                  />
                </div>

                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200/70 p-3.5 rounded-2xl">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  <span>Double check your {activeWithdrawNet.label} withdrawal address carefully. Transferred funds cannot be reversed.</span>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition shadow-md disabled:opacity-60 flex items-center justify-center gap-2 text-xs"
                >
                  {loading ? <RefreshCw size={15} className="animate-spin" /> : <ArrowUp size={15} />}
                  Submit Withdrawal Request ({activeWithdrawNet.label})
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <History size={18} className="text-brand" /> Transaction Audit Ledger
          </h2>
          <button onClick={fetchTransactionHistory} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-brand transition" title="Refresh">
            <RefreshCw size={15} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {historyLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <History size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No transactions recorded yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Your deposits and withdrawals will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map(t => {
              const cfg = TYPE_CONFIG[t.type] || { label: t.type, icon: <DollarSign size={14} />, positive: t.amount > 0 };
              const isPositive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/70 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? 'bg-emerald-50 text-brand' : 'bg-red-50 text-red-600'}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">{cfg.label}</span>
                      {t.is_admin_action && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold tabular-nums ${isPositive ? 'text-brand' : 'text-red-600'}`}>
                      {isPositive ? '+' : '-'}{fmt(t.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t.status}
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
