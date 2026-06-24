import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { Wallet, ArrowDown, ArrowUp, Copy, Check, Send, RefreshCw, History, AlertCircle } from 'lucide-react';

interface DepositMethod {
  currency: string;
  network: string;
  address: string;
  min: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  is_admin_action?: boolean;
}

export default function WalletPage() {
  const { profile, refreshProfile } = useAuthStore();
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Check restriction – if can_withdraw is false, show a message
  if (profile && !profile.can_withdraw) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-600">Withdrawals Disabled</h2>
        <p className="text-gray-600">{profile.restriction_reason || 'You are not allowed to withdraw funds. Please contact support.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-2 text-sm">A deposit of ${profile.fee_required} is required to unlock withdrawals.</p>
        )}
        <Link to="/app" className="mt-4 inline-block text-brand hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  useEffect(() => {
    fetchSettings();
    fetchTransactionHistory();
  }, [profile?.id]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'deposit_methods')
      .single();
    if (error) {
      console.error('Failed to fetch deposit methods:', error);
      toast.error('Deposit methods not configured. Contact support.');
      return;
    }
    try {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setDepositMethods(parsed);
        setSelectedCurrency(parsed[0].currency);
      } else {
        toast.error('No deposit methods configured.');
      }
    } catch {
      toast.error('Invalid deposit methods format.');
    }
  };

  const fetchTransactionHistory = async () => {
    if (!profile) return;
    setHistoryLoading(true);
    try {
      const { data: txs, error: txsErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (txsErr) throw txsErr;

      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id, amount, address, status, created_at')
        .eq('user_id', profile.id);

      const { data: deposits } = await supabase
        .from('deposits')
        .select('id, amount, status, created_at')
        .eq('user_id', profile.id);

      const all: Transaction[] = [];

      txs?.forEach((t) => {
        all.push({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description || t.type,
          status: t.status || 'completed',
          created_at: t.created_at,
          is_admin_action: t.type === 'admin' || (t.description && t.description.toLowerCase().includes('admin')),
        });
      });

      withdrawals?.forEach((w) => {
        if (w.status !== 'completed' && w.status !== 'approved' && w.status !== 'rejected') {
          all.push({
            id: w.id,
            type: 'withdrawal',
            amount: -w.amount,
            description: `Withdrawal request to ${w.address.substring(0, 10)}...`,
            status: w.status,
            created_at: w.created_at,
            is_admin_action: false,
          });
        }
      });

      deposits?.forEach((d) => {
        if (d.status !== 'confirmed') {
          all.push({
            id: d.id,
            type: 'deposit',
            amount: d.amount,
            description: 'Pending deposit',
            status: d.status,
            created_at: d.created_at,
            is_admin_action: false,
          });
        }
      });

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(all);
    } catch (err) {
      console.error('Failed to fetch transaction history:', err);
      toast.error('Could not load transaction history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDepositConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const method = depositMethods.find(m => m.currency === selectedCurrency);
    if (!method) {
      toast.error('Selected currency not found');
      return;
    }
    if (amount < method.min) {
      toast.error(`Minimum deposit for ${method.currency} is $${method.min}`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('deposits').insert({
        user_id: profile.id,
        amount: amount,
        transaction_hash: selectedCurrency,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Deposit recorded. Waiting for confirmation.');
      setDepositAmount('');
      await fetchTransactionHistory();
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!profile.can_withdraw) {
      toast.error('Withdrawals are disabled for your account');
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (profile.wallet_balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }
    if (!withdrawAddress) {
      toast.error('Enter a withdrawal address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('withdrawals').insert({
        user_id: profile.id,
        amount: amount,
        address: withdrawAddress,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Withdrawal request submitted!');
      setWithdrawAmount('');
      setWithdrawAddress('');
      await fetchTransactionHistory();
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    const method = depositMethods.find(m => m.currency === selectedCurrency);
    if (!method || !method.address) return;
    navigator.clipboard.writeText(method.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied!');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
  };

  const selectedMethod = depositMethods.find(m => m.currency === selectedCurrency);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      confirmed: 'bg-green-100 text-green-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      investment: 'Investment',
      return: 'Daily Return',
      admin: 'Admin Adjustment',
    };
    return map[type] || type;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">Wallet</h1>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex items-center gap-4 hover:shadow-xl transition-shadow">
        <div className="p-3 bg-green-100 rounded-xl text-brand">
          <Wallet size={32} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-3xl font-bold">{formatCurrency(profile?.wallet_balance || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <ArrowDown size={20} className="text-green-500" /> Deposit to Your Account
          </h2>
          {depositMethods.length === 0 ? (
            <p className="text-red-500">No deposit methods configured. Please contact support.</p>
          ) : (
            <>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">Select Currency</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                >
                  {depositMethods.map((m) => (
                    <option key={m.currency} value={m.currency}>{m.currency} ({m.network})</option>
                  ))}
                </select>
              </div>
              {selectedMethod && (
                <>
                  <p className="text-gray-600 text-sm mb-2">
                    Your personal deposit address for <strong>{selectedMethod.currency}</strong>:
                  </p>
                  <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between border border-gray-200">
                    <code className="text-sm break-all font-mono">{selectedMethod.address}</code>
                    <button onClick={copyAddress} className="ml-2 p-1 hover:bg-gray-200 rounded flex-shrink-0">
                      {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p><span className="font-medium">Network:</span> {selectedMethod.network}</p>
                    <p><span className="font-medium">Minimum Deposit:</span> ${selectedMethod.min}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    This address is assigned to your account. Send only {selectedMethod.currency} to this address.
                  </p>
                </>
              )}
              <form onSubmit={handleDepositConfirm} className="mt-4 flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min={selectedMethod?.min || 0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  placeholder={`Amount (min $${selectedMethod?.min || 0})`}
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-70 shadow-md hover:shadow-lg"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                  Confirm
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-2">
                After sending, click "Confirm" to notify us. You'll receive an email upon confirmation.
              </p>
            </>
          )}
        </div>

        {/* Withdraw Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <ArrowUp size={20} className="text-red-500" /> Withdraw Funds
          </h2>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand"
                placeholder="100.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand"
                placeholder="Your crypto address"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-70 shadow-md hover:shadow-lg"
            >
              {loading ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-brand" />
          <h2 className="text-lg font-semibold">Transaction History</h2>
        </div>
        {historyLoading ? (
          <p className="text-gray-500 text-center py-4">Loading history...</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-left p-3 font-semibold">Description</th>
                  <th className="text-left p-3 font-semibold">Amount</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className="text-xs font-medium">{getTypeLabel(t.type)}</span>
                      {t.is_admin_action && (
                        <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Admin</span>
                      )}
                    </td>
                    <td className="p-3 max-w-xs truncate">{t.description}</td>
                    <td className={`p-3 font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(t.status)}`}>
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>
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