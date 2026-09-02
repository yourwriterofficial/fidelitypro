import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import {
  AlertCircle, Calculator, Lock, Clock, X, CheckCircle2, History
} from 'lucide-react';
import { notifyAdmins, notifyUser } from '../lib/notify';

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

export default function Staking() {
  const { profile, refreshProfile } = useAuthStore();
  const { stakeRestricted } = useAccountRestriction();
  const [products, setProducts] = useState<StakingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StakingProduct | null>(null);
  const [amount, setAmount] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [stakingOrders, setStakingOrders] = useState<StakingOrder[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number>(500);
  const [calcProduct, setCalcProduct] = useState<StakingProduct | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; orderId: string | null; action: 'claim' | 'withdraw_early' | null }>({ open: false, orderId: null, action: null });
  const [processing, setProcessing] = useState(false);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('staking_products')
      .select('*')
      .eq('status', 'active')
      .order('lock_days', { ascending: true });
    if (error) toast.error('Failed to load staking products');
    else {
      setProducts(data || []);
      if (data?.length) setCalcProduct(data[0]);
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('staking_orders')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load staking orders'); return; }
    const computed = data.map((order: any) => {
      const apy = parseFloat(order.apy) || 0, lockDays = parseInt(order.lock_days) || 0;
      const penalty = parseFloat(order.early_withdrawal_penalty) || 0, amt = parseFloat(order.amount) || 0;
      const maturity = amt * (1 + (apy / 100) * (lockDays / 365));
      const penaltyAmt = amt * (penalty / 100);
      const returnAmt = amt - penaltyAmt;
      const now = new Date(), end = new Date(order.end_date);
      const isMatured = end <= now;
      let timeLeft: string;
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
      let timeLeft: string;
      if (!isMatured) {
        const diff = end.getTime() - now.getTime();
        const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
        const m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
        timeLeft = `${d}d ${h}h ${m}m ${s}s`;
      } else { timeLeft = 'Matured ✓'; }
      return { ...order, timeLeft, isMatured };
    }));
  };

  useEffect(() => {
    fetchProducts(); fetchOrders();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const calcResult = useMemo(() => {
    if (!calcProduct || !calcAmount) return null;
    const apy = calcProduct.apy / 100, days = calcProduct.lock_days;
    const interest = calcAmount * (apy / 365) * days;
    return { interest, total: calcAmount + interest, dailyInterest: interest / days };
  }, [calcProduct, calcAmount]);

  if (profile && (!profile.can_stake || stakeRestricted)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Staking Suspended</h2>
        <p className="text-gray-500 text-sm mt-2">
          {stakeRestricted
            ? 'Staking features are suspended due to account inactivity. Please top up your wallet to restore access.'
            : (profile.restriction_reason || 'Contact support to unlock staking.')
          }
        </p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">A deposit of <strong>${profile.fee_required}</strong> is required to unlock.</p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-medium hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProduct) return;
    if (!profile.can_stake || stakeRestricted) { toast.error('Staking is disabled for your account'); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedProduct.min_amount || (selectedProduct.max_amount && numAmount > selectedProduct.max_amount)) {
      toast.error(`Amount must be between $${selectedProduct.min_amount} and $${selectedProduct.max_amount || '∞'}`); return;
    }
    if (numAmount > profile.wallet_balance) { toast.error('Insufficient wallet balance'); return; }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount: numAmount });
      const endDate = new Date(Date.now() + selectedProduct.lock_days * 864e5).toISOString();
      const { error } = await supabase.from('staking_orders').insert({
        user_id: profile.id, product_id: selectedProduct.id, product_name: selectedProduct.name,
        amount: numAmount, apy: selectedProduct.apy, early_withdrawal_penalty: selectedProduct.early_withdrawal_penalty,
        lock_days: selectedProduct.lock_days, end_date: endDate, status: 'active',
      });
      if (error) throw error;
      const userName = profile.name || profile.email || 'Investor';
      notifyAdmins({
        title: `[Staking] ${userName} ($${numAmount.toLocaleString()})`,
        message: `${userName} locked $${numAmount.toLocaleString()} in ${selectedProduct.name} (${selectedProduct.lock_days} days @ ${selectedProduct.apy}% APY).`,
        type: 'alert',
        link: '/admin/staking'
      });
      // Dispatch user confirmation
      notifyUser({
        userId: profile.id,
        title: 'Staking Certificate Active',
        message: `You locked $${numAmount.toLocaleString()} in ${selectedProduct.name} (${selectedProduct.lock_days} days @ ${selectedProduct.apy}% APY).`,
        type: 'success',
        link: '/app/staking',
      });
      toast.success('Funds committed to lock successfully!');
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
      // Dispatch user confirmation
      if (profile?.id) {
        notifyUser({
          userId: profile.id,
          title: 'Staking Earnings Claimed',
          message: `$${order.maturityAmount.toFixed(2)} from your matured ${order.product_name} staking contract has been credited to your wallet balance.`,
          type: 'success',
          link: '/app/staking',
        });
      }
      toast.success(`$${order.maturityAmount.toFixed(2)} credited to your wallet!`);
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
      toast.success(`Early withdrawal settled: $${order.returnAmount.toFixed(2)} received.`);
      await refreshProfile(); fetchOrders();
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); setConfirmModal({ open: false, orderId: null, action: null }); }
  };

  const activeStakes = stakingOrders.filter(o => o.status === 'active');
  const pastStakes = stakingOrders.filter(o => o.status !== 'active');
  const totalLockedAmount = activeStakes.reduce((sum, o) => sum + o.amount, 0);
  const totalProjectedReturns = activeStakes.reduce((sum, o) => sum + (o.maturityAmount - o.amount), 0);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-3xl h-64" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Fixed Income Certificates
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Locked Savings & Staking
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Commit capital for set terms. Earn fixed compounding APY with 100% guaranteed principal return.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Available Wallet</span>
            <span className="text-base font-extrabold text-brand tabular-nums">{fmt(profile?.wallet_balance || 0)}</span>
          </div>
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-brand text-white font-bold text-xs px-4 py-3 rounded-2xl transition shadow-sm"
          >
            <Calculator size={15} /> Calculate APY
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Active Capital Locked</span>
          <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">{fmt(totalLockedAmount)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{activeStakes.length} active certificates</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Estimated Maturity Yield</span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1 tabular-nums">+{fmt(totalProjectedReturns)}</p>
          <span className="text-xs text-gray-400 mt-1 block">Accruing daily</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Principal Security</span>
          <p className="text-2xl font-extrabold text-brand mt-1 tabular-nums">100%</p>
          <span className="text-xs text-gray-400 mt-1 block">Protected by reserve vault</span>
        </div>
      </div>

      {/* APY Return Calculator */}
      {showCalc && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md p-6 sm:p-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand/10 text-brand rounded-xl">
                <Calculator size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Yield & Maturity Calculator</h2>
            </div>
            <button onClick={() => setShowCalc(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Select Term Tier</label>
                <select
                  value={calcProduct?.id || ''}
                  onChange={e => setCalcProduct(products.find(p => p.id === e.target.value) || null)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.lock_days} Days ({p.apy}% APY)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Amount to Commit (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    min={calcProduct?.min_amount || 10}
                    max={calcProduct?.max_amount || 100000}
                    value={calcAmount}
                    onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-bold"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Tier Limits: ${calcProduct?.min_amount?.toLocaleString()} min — ${calcProduct?.max_amount ? calcProduct.max_amount.toLocaleString() : 'Unlimited'} max
                </p>
              </div>
            </div>

            {calcResult && (
              <div className="bg-gray-900 text-white rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Total at Maturity</span>
                  <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tabular-nums mt-1">{fmt(calcResult.total)}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-800 text-xs">
                    <div>
                      <span className="text-gray-400 block">Net Interest</span>
                      <span className="font-bold text-emerald-400 text-sm">+{fmt(calcResult.interest)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Daily Earned</span>
                      <span className="font-bold text-white text-sm">+{fmt(calcResult.dailyInterest)}/day</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Lock Duration</span>
                      <span className="font-bold text-white">{calcProduct?.lock_days} Days</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Fixed APY</span>
                      <span className="font-bold text-brand-light">{calcProduct?.apy}% APY</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-4">
                  * Note: Early liquidation incurs a {calcProduct?.early_withdrawal_penalty}% penalty fee on principal.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHRONOLOGICAL SECTION 1: Active Locks Timeline */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Active Locked Certificates ({activeStakes.length})</h2>
              <p className="text-xs text-gray-400">Current positions sorted by maturity timeline</p>
            </div>
          </div>
        </div>

        {activeStakes.length === 0 ? (
          <div className="py-16 text-center">
            <Lock size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-bold text-sm">No active locked savings certificates</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Choose a duration tier below to commit funds and begin earning guaranteed daily yields.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificate / Tier</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Locked Capital</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">APY Rate</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Maturity Value</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Maturity Countdown</th>
                  <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeStakes.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {order.lock_days}d
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{order.product_name}</span>
                          <span className="text-[11px] text-gray-400">Locked on {new Date(order.start_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 tabular-nums">{fmt(order.amount)}</td>
                    <td className="px-6 py-4 font-bold text-indigo-700">{order.apy}% APY</td>
                    <td className="px-6 py-4 font-extrabold text-emerald-700 tabular-nums">{fmt(order.maturityAmount)}</td>
                    <td className="px-6 py-4">
                      {order.isMatured ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-bold">
                          <CheckCircle2 size={13} /> Matured & Ready
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl inline-block">
                          {order.timeLeft}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.isMatured ? (
                        <button
                          onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'claim' })}
                          disabled={processing}
                          className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          Claim {fmt(order.maturityAmount)}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'withdraw_early' })}
                          disabled={processing}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                        >
                          Withdraw Early
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHRONOLOGICAL SECTION 2: Available Staking Lock Tiers */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Available Lock Tiers (Chronological Duration)</h2>
            <p className="text-xs text-gray-500">Select your term duration to commit funds</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => {
            const minMaturity = p.min_amount * (1 + (p.apy / 100) * (p.lock_days / 365));
            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-xl hover:border-brand/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                      {p.lock_days} Days Lock
                    </span>
                    <span className="text-xs font-medium text-gray-400">Fixed Rate</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mt-2">{p.name}</h3>
                  <div className="my-3">
                    <span className="text-3xl font-extrabold text-brand tracking-tight">{p.apy}%</span>
                    <span className="text-xs text-gray-500 ml-1 font-semibold">APY</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{p.description}</p>

                  <div className="space-y-2 text-xs border-t border-gray-100 pt-3">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Minimum Entry</span>
                      <span className="font-bold text-gray-900">${p.min_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Maximum Limit</span>
                      <span className="font-bold text-gray-900">${p.max_amount ? p.max_amount.toLocaleString() : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Early Penalty</span>
                      <span className="font-semibold text-red-600">{p.early_withdrawal_penalty}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Min Maturity Return</span>
                      <span className="font-bold text-emerald-700">{fmt(minMaturity)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedProduct(p); setModalOpen(true); }}
                  className="mt-6 w-full bg-gray-900 group-hover:bg-brand text-white font-bold py-3 rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Lock size={14} /> Commit to {p.lock_days}d Lock
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHRONOLOGICAL SECTION 3: Completed & Historical Staking Logs */}
      {pastStakes.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2.5">
            <div className="p-2 bg-gray-100 text-gray-700 rounded-xl">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Historical & Completed Certificates ({pastStakes.length})</h2>
              <p className="text-xs text-gray-400">Settled and withdrawn staking certificates</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificate</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Settled Value</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Closed</th>
                  <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pastStakes.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-900">{order.product_name} ({order.lock_days}d)</td>
                    <td className="px-6 py-3.5 tabular-nums text-gray-700">{fmt(order.amount)}</td>
                    <td className="px-6 py-3.5 font-bold text-emerald-700 tabular-nums">
                      {order.status === 'completed' ? fmt(order.maturityAmount) : fmt(order.returnAmount)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 text-xs">{new Date(order.end_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stake Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Lock Savings Certificate</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedProduct.name} • {selectedProduct.lock_days} Days Term</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-2xl p-4 mb-5 grid grid-cols-2 gap-3 text-xs border border-gray-100">
                <div>
                  <span className="text-gray-400 block">Available Balance</span>
                  <span className="font-extrabold text-emerald-700 text-sm">{fmt(profile?.wallet_balance || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Fixed APY Rate</span>
                  <span className="font-extrabold text-brand text-sm">{selectedProduct.apy}%</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Minimum Capital</span>
                  <span className="font-bold text-gray-900">${selectedProduct.min_amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Early Liquidation Penalty</span>
                  <span className="font-bold text-red-600">{selectedProduct.early_withdrawal_penalty}%</span>
                </div>
              </div>

              <form onSubmit={handleStake} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Deposit Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedProduct.min_amount}
                      max={selectedProduct.max_amount || undefined}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3.5 border border-gray-300 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder={`Min $${selectedProduct.min_amount}`}
                      required
                    />
                  </div>
                  {amount && parseFloat(amount) > 0 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs flex justify-between items-center">
                      <span className="text-emerald-800 font-medium">Estimated Return at Maturity:</span>
                      <span className="font-extrabold text-emerald-800">
                        {fmt(parseFloat(amount) + parseFloat(amount) * (selectedProduct.apy/100) * (selectedProduct.lock_days/365))}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-sm"
                >
                  <Lock size={15} /> Confirm Lock
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && confirmModal.orderId && (() => {
        const order = stakingOrders.find(o => o.id === confirmModal.orderId);
        if (!order) return null;
        const isClaim = confirmModal.action === 'claim';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {isClaim ? 'Settle Maturity Certificate' : 'Request Early Withdrawal'}
              </h2>
              <p className="text-xs text-gray-500 mb-5">
                {isClaim
                  ? 'Your certificate has matured. Full principal plus accumulated yield will be credited to your wallet.'
                  : 'Early liquidation will terminate this certificate and apply the contractual penalty.'}
              </p>

              {!isClaim && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 text-xs mb-5">
                  <div className="flex justify-between"><span className="text-gray-500">Initial Principal</span><span className="font-bold">{fmt(order.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Penalty Rate ({order.early_withdrawal_penalty}%)</span><span className="font-bold text-red-600">−{fmt(order.penaltyAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-bold">Net Payout to Wallet</span><span className="font-extrabold text-emerald-700 text-sm">{fmt(order.returnAmount)}</span></div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { if (isClaim) { handleClaim(confirmModal.orderId!); } else { handleWithdrawEarly(confirmModal.orderId!); } }}
                  disabled={processing}
                  className="w-full sm:flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-2xl transition disabled:opacity-60 flex items-center justify-center text-xs shadow-md"
                >
                  {processing ? 'Processing...' : isClaim ? 'Claim Full Payout' : 'Confirm Early Settlement'}
                </button>
                <button
                  onClick={() => setConfirmModal({ open: false, orderId: null, action: null })}
                  className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-2xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
