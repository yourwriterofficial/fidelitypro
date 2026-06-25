import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import {
  AlertCircle, Calculator, ChevronDown, ChevronUp, Wallet,
  Lock, Clock, X, TrendingUp, Zap, ShieldCheck,
} from 'lucide-react';

interface StakingProduct {
  id: string; name: string; description: string;
  min_amount: number; max_amount: number; apy: number;
  lock_days: number; early_withdrawal_penalty: number;
}

interface StakingOrder {
  id: string; product_id: string; product_name: string;
  amount: number; apy: number; early_withdrawal_penalty: number;
  lock_days: number; start_date: string; end_date: string;
  status: 'active' | 'completed' | 'withdrawn_early';
  created_at: string; maturityAmount: number; penaltyAmount: number;
  returnAmount: number; timeLeft: string; isMatured: boolean;
}

const APY_COLORS = ['from-blue-500 to-indigo-600', 'from-brand to-emerald-600', 'from-purple-500 to-pink-500', 'from-amber-400 to-orange-500'];

export default function Staking() {
  const { profile, refreshProfile } = useAuthStore();
  const [products, setProducts] = useState<StakingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StakingProduct | null>(null);
  const [amount, setAmount] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [stakingOrders, setStakingOrders] = useState<StakingOrder[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number>(100);
  const [calcProduct, setCalcProduct] = useState<StakingProduct | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; orderId: string | null; action: 'claim' | 'withdraw_early' | null }>({ open: false, orderId: null, action: null });
  const [processing, setProcessing] = useState(false);

  if (profile && !profile.can_stake) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Staking Disabled</h2>
        <p className="text-gray-500 text-sm mt-2">{profile.restriction_reason || 'Contact support to unlock staking.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">A deposit of <strong>${profile.fee_required}</strong> is required to unlock.</p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-medium hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  useEffect(() => {
    fetchProducts(); fetchOrders();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('staking_products').select('*').eq('status', 'active');
    if (error) toast.error('Failed to load staking products');
    else { setProducts(data || []); if (data?.length) setCalcProduct(data[0]); }
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!profile) return;
    const { data, error } = await supabase.from('staking_orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load staking orders'); return; }
    const computed = data.map((order: any) => {
      const apy = parseFloat(order.apy) || 0, lockDays = parseInt(order.lock_days) || 0;
      const penalty = parseFloat(order.early_withdrawal_penalty) || 0, amt = parseFloat(order.amount) || 0;
      const maturity = amt * (1 + (apy / 100) * (lockDays / 365));
      const penaltyAmt = amt * (penalty / 100);
      const returnAmt = amt - penaltyAmt;
      const now = new Date(), end = new Date(order.end_date);
      const isMatured = end <= now;
      let timeLeft = '';
      if (order.status === 'active') {
        if (!isMatured) {
          const diff = end.getTime() - now.getTime();
          const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
          const m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
          timeLeft = `${d}d ${h}h ${m}m ${s}s`;
        } else { timeLeft = 'Matured ✓'; }
      } else { timeLeft = '—'; }
      return { ...order, maturityAmount: maturity, penaltyAmount: penaltyAmt, returnAmount: returnAmt, timeLeft, isMatured };
    });
    setStakingOrders(computed);
  };

  const updateCountdowns = () => {
    setStakingOrders(prev => prev.map(order => {
      if (order.status !== 'active') return order;
      const now = new Date(), end = new Date(order.end_date);
      const isMatured = end <= now;
      let timeLeft = '';
      if (!isMatured) {
        const diff = end.getTime() - now.getTime();
        const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
        const m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
        timeLeft = `${d}d ${h}h ${m}m ${s}s`;
      } else { timeLeft = 'Matured ✓'; }
      return { ...order, timeLeft, isMatured };
    }));
  };

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProduct) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedProduct.min_amount || (selectedProduct.max_amount && numAmount > selectedProduct.max_amount)) {
      toast.error(`Amount must be between $${selectedProduct.min_amount} and $${selectedProduct.max_amount || '∞'}`); return;
    }
    if (numAmount > profile.wallet_balance) { toast.error('Insufficient balance'); return; }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount: numAmount });
      const endDate = new Date(Date.now() + selectedProduct.lock_days * 864e5).toISOString();
      const { error } = await supabase.from('staking_orders').insert({
        user_id: profile.id, product_id: selectedProduct.id, product_name: selectedProduct.name,
        amount: numAmount, apy: selectedProduct.apy, early_withdrawal_penalty: selectedProduct.early_withdrawal_penalty,
        lock_days: selectedProduct.lock_days, end_date: endDate, status: 'active',
      });
      if (error) throw error;
      toast.success('Funds locked successfully!');
      await refreshProfile(); fetchOrders(); setModalOpen(false); setAmount('');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleClaim = async (orderId: string) => {
    if (processing) return;
    const order = stakingOrders.find(o => o.id === orderId);
    if (!order || order.status !== 'active' || !order.isMatured) return toast.error('Cannot claim yet');
    setProcessing(true);
    try {
      await supabase.rpc('add_wallet_balance', { user_id: profile?.id, amount: order.maturityAmount });
      await supabase.from('transactions').insert({ user_id: profile?.id, type: 'return', amount: order.maturityAmount, description: `Staking maturity for ${order.product_name}`, status: 'completed' });
      await supabase.from('staking_orders').update({ status: 'completed' }).eq('id', orderId);
      toast.success(`$${order.maturityAmount.toFixed(2)} credited!`);
      await refreshProfile(); fetchOrders();
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); setConfirmModal({ open: false, orderId: null, action: null }); }
  };

  const handleWithdrawEarly = async (orderId: string) => {
    if (processing) return;
    const order = stakingOrders.find(o => o.id === orderId);
    if (!order || order.status !== 'active' || order.isMatured) return toast.error('Cannot withdraw early');
    setProcessing(true);
    try {
      await supabase.rpc('add_wallet_balance', { user_id: profile?.id, amount: order.returnAmount });
      await supabase.from('transactions').insert({ user_id: profile?.id, type: 'withdrawal', amount: order.returnAmount, description: `Early withdrawal from ${order.product_name} – penalty $${order.penaltyAmount.toFixed(2)} applied`, status: 'completed' });
      await supabase.from('staking_orders').update({ status: 'withdrawn_early' }).eq('id', orderId);
      toast.success(`Withdrawal successful! Received $${order.returnAmount.toFixed(2)}.`);
      await refreshProfile(); fetchOrders();
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); setConfirmModal({ open: false, orderId: null, action: null }); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const calcResult = useMemo(() => {
    if (!calcProduct || !calcAmount) return null;
    const apy = calcProduct.apy / 100, days = calcProduct.lock_days;
    const interest = calcAmount * (apy / 365) * days;
    return { interest, total: calcAmount + interest, dailyInterest: interest / days };
  }, [calcProduct, calcAmount]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-64" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locked Savings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Lock your funds for a fixed period and earn guaranteed APY.</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
          <Wallet size={16} className="text-emerald-600" />
          <span className="text-emerald-800">Balance: <strong>{fmt(profile?.wallet_balance || 0)}</strong></span>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: <ShieldCheck size={14} />, text: 'Capital Protected', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          { icon: <TrendingUp  size={14} />, text: 'Guaranteed APY',    color: 'bg-blue-50 text-blue-700 border-blue-100' },
          { icon: <Zap         size={14} />, text: 'Instant Unlock',    color: 'bg-amber-50 text-amber-700 border-amber-100' },
        ].map(({ icon, text, color }) => (
          <span key={text} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${color}`}>{icon}{text}</span>
        ))}
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => setShowCalc(!showCalc)} className="flex items-center justify-between w-full px-6 py-4 hover:bg-gray-50/50 transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl"><Calculator size={17} className="text-brand" /></div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">APY Calculator</p>
              <p className="text-xs text-gray-400">Estimate your staking earnings</p>
            </div>
          </div>
          {showCalc ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showCalc && (
          <div className="border-t border-gray-100 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Product</label>
                <select value={calcProduct?.id || ''} onChange={e => setCalcProduct(products.find(p => p.id === e.target.value) || null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent">
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
                <input type="number" min={calcProduct?.min_amount || 10} max={calcProduct?.max_amount || 100000}
                  value={calcAmount} onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1">Min: ${calcProduct?.min_amount} – Max: ${calcProduct?.max_amount || '∞'}</p>
              </div>
            </div>
            {calcResult && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-white space-y-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Estimated Maturity Value</p>
                <p className="text-4xl font-extrabold tabular-nums text-emerald-400">{fmt(calcResult.total)}</p>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-sm">
                  <div><p className="text-gray-400 text-xs">Interest</p><p className="font-bold text-emerald-400">{fmt(calcResult.interest)}</p></div>
                  <div><p className="text-gray-400 text-xs">Daily Interest</p><p className="font-bold text-white">{fmt(calcResult.dailyInterest)}</p></div>
                  <div><p className="text-gray-400 text-xs">APY</p><p className="font-bold text-white">{calcProduct?.apy}%</p></div>
                  <div><p className="text-gray-400 text-xs">Lock Period</p><p className="font-bold text-white flex items-center gap-1"><Clock size={12} /> {calcProduct?.lock_days}d</p></div>
                </div>
                <p className="text-[10px] text-gray-500">Early withdrawal penalty of {calcProduct?.early_withdrawal_penalty}% applies.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p, i) => {
          const accent = APY_COLORS[i % APY_COLORS.length];
          const maturity = p.min_amount * (1 + (p.apy / 100) * (p.lock_days / 365));
          return (
            <div key={p.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="p-6">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand transition-colors">{p.name}</h3>
                  <span className={`text-2xl font-extrabold bg-gradient-to-r ${accent} bg-clip-text text-transparent tabular-nums`}>{p.apy}%</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">APY</p>
                <p className="text-gray-500 text-sm mb-4">{p.description}</p>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Lock Period', value: `${p.lock_days} days` },
                    { label: 'Min / Max', value: `$${p.min_amount.toLocaleString()} / $${p.max_amount?.toLocaleString() || '∞'}` },
                    { label: 'Early Penalty', value: `${p.early_withdrawal_penalty}%` },
                    { label: 'Est. Maturity (min)', value: fmt(maturity), highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400">{label}</span>
                      <span className={`font-semibold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedProduct(p); setModalOpen(true); }}
                  className={`mt-5 w-full bg-gradient-to-r ${accent} text-white font-semibold py-3 rounded-xl transition hover:opacity-90 shadow-md flex items-center justify-center gap-2`}
                >
                  <Lock size={15} /> Lock Funds
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staking Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Your Locked Savings ({stakingOrders.length})</h2>
        </div>
        {stakingOrders.length === 0 ? (
          <div className="py-12 text-center">
            <Lock size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No locked savings yet. Start staking above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Product', 'Amount', 'Maturity Value', 'Status', 'Time Left', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stakingOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{order.product_name}</td>
                    <td className="px-4 py-3.5 tabular-nums">{fmt(order.amount)}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium tabular-nums">
                      {['active','completed'].includes(order.status) ? fmt(order.maturityAmount) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${
                        order.status === 'active' && !order.isMatured ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        order.status === 'active' && order.isMatured  ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        order.status === 'completed'                  ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-gray-50 text-gray-600 border-gray-100'
                      }`}>
                        {order.status === 'active' && order.isMatured ? 'Ready to Claim' : order.status === 'active' ? 'Active' : order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-600">{order.timeLeft}</td>
                    <td className="px-4 py-3.5 space-x-2">
                      {order.status === 'active' && order.isMatured && (
                        <button onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'claim' })} disabled={processing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60">
                          Claim
                        </button>
                      )}
                      {order.status === 'active' && !order.isMatured && (
                        <button onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'withdraw_early' })} disabled={processing}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60">
                          Withdraw Early
                        </button>
                      )}
                      {order.status === 'completed' && <span className="text-xs text-gray-400">Completed</span>}
                      {order.status === 'withdrawn_early' && <span className="text-xs text-gray-400">Withdrawn</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stake Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Lock Funds</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedProduct.name} · {selectedProduct.apy}% APY · {selectedProduct.lock_days} days</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition"><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Your Balance</p><p className="font-bold text-emerald-600">{fmt(profile?.wallet_balance || 0)}</p></div>
                <div><p className="text-xs text-gray-400">Early Penalty</p><p className="font-bold text-red-500">{selectedProduct.early_withdrawal_penalty}%</p></div>
                <div><p className="text-xs text-gray-400">Min Amount</p><p className="font-bold text-gray-900">${selectedProduct.min_amount.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-400">Max Amount</p><p className="font-bold text-gray-900">${selectedProduct.max_amount?.toLocaleString() || '∞'}</p></div>
              </div>
              <form onSubmit={handleStake} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input type="number" step="0.01" min={selectedProduct.min_amount} max={selectedProduct.max_amount || undefined}
                      value={amount} onChange={e => setAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder={`Min $${selectedProduct.min_amount}`} required />
                  </div>
                  {amount && parseFloat(amount) > 0 && (
                    <p className="text-xs text-emerald-600 mt-1.5">
                      At maturity: {fmt(parseFloat(amount) + parseFloat(amount) * (selectedProduct.apy/100) * (selectedProduct.lock_days/365))}
                    </p>
                  )}
                </div>
                <button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2">
                  <Lock size={15} /> Lock Now
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm transition">Cancel</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.open && confirmModal.orderId && (() => {
        const order = stakingOrders.find(o => o.id === confirmModal.orderId);
        if (!order) return null;
        const isClaim = confirmModal.action === 'claim';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{isClaim ? 'Claim Maturity' : 'Withdraw Early'}</h2>
              <p className="text-sm text-gray-500 mb-5">{isClaim ? 'You will receive the full maturity amount.' : 'A penalty will be applied for early withdrawal.'}</p>
              {!isClaim && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm mb-5">
                  <div className="flex justify-between"><span className="text-gray-500">Principal</span><span className="font-semibold">{fmt(order.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Penalty ({order.early_withdrawal_penalty}%)</span><span className="font-semibold text-red-500">−{fmt(order.penaltyAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-semibold">You receive</span><span className="font-bold text-emerald-600">{fmt(order.returnAmount)}</span></div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { isClaim ? handleClaim(confirmModal.orderId!) : handleWithdrawEarly(confirmModal.orderId!); }}
                  disabled={processing}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-60">
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmModal({ open: false, orderId: null, action: null })}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm transition">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
