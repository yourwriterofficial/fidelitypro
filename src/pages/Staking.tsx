import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Lock, Clock, TrendingUp, AlertCircle, Calculator, ChevronDown, ChevronUp, Wallet, ArrowRight } from 'lucide-react';

interface StakingProduct {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  apy: number;
  lock_days: number;
  early_withdrawal_penalty: number;
}

interface StakingOrder {
  id: string;
  product_id: string;
  product_name: string;
  amount: number;
  apy: number;
  early_withdrawal_penalty: number;
  lock_days: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'withdrawn_early';
  created_at: string;
  maturityAmount: number;
  penaltyAmount: number;
  returnAmount: number;
  timeLeft: string;
  isMatured: boolean;
}

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

  // Check restriction
  if (profile && !profile.can_stake) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-600">Staking Disabled</h2>
        <p className="text-gray-600">{profile.restriction_reason || 'You are not allowed to stake funds. Please contact support.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-2 text-sm">A deposit of ${profile.fee_required} is required to unlock staking.</p>
        )}
        <Link to="/app" className="mt-4 inline-block text-brand hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    const interval = setInterval(() => {
      updateCountdowns();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('staking_products')
      .select('*')
      .eq('status', 'active');
    if (error) toast.error('Failed to load staking products');
    else {
      setProducts(data || []);
      if (data && data.length > 0) setCalcProduct(data[0]);
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
    if (error) {
      console.error(error);
      toast.error('Failed to load staking orders');
    } else {
      const ordersWithComputed = data.map((order: any) => {
        const apy = parseFloat(order.apy) || 0;
        const lockDays = parseInt(order.lock_days) || 0;
        const penaltyPercent = parseFloat(order.early_withdrawal_penalty) || 0;
        const amount = parseFloat(order.amount) || 0;

        const maturity = amount * (1 + (apy / 100) * (lockDays / 365));
        const penalty = amount * (penaltyPercent / 100);
        const returnAmt = amount - penalty;
        const now = new Date();
        const end = new Date(order.end_date);
        const isMatured = end <= now;
        let timeLeft = '';
        if (order.status === 'active') {
          if (!isMatured) {
            const diff = end.getTime() - now.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            timeLeft = `${days}d ${hours}h ${minutes}m ${seconds}s`;
          } else {
            timeLeft = 'Matured';
          }
        } else {
          timeLeft = '—';
        }
        return {
          ...order,
          maturityAmount: maturity,
          penaltyAmount: penalty,
          returnAmount: returnAmt,
          timeLeft,
          isMatured,
        };
      });
      setStakingOrders(ordersWithComputed);
    }
  };

  const updateCountdowns = () => {
    setStakingOrders(prev => 
      prev.map(order => {
        if (order.status !== 'active') return order;
        const now = new Date();
        const end = new Date(order.end_date);
        const isMatured = end <= now;
        let timeLeft = '';
        if (!isMatured) {
          const diff = end.getTime() - now.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          timeLeft = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else {
          timeLeft = 'Matured';
        }
        return { ...order, timeLeft, isMatured };
      })
    );
  };

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProduct) return;
    if (!profile.can_stake) {
      toast.error('Staking is disabled for your account');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedProduct.min_amount || (selectedProduct.max_amount && numAmount > selectedProduct.max_amount)) {
      toast.error(`Amount must be between $${selectedProduct.min_amount} and $${selectedProduct.max_amount || '∞'}`);
      return;
    }
    if (numAmount > profile.wallet_balance) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount: numAmount });
      const endDate = new Date(Date.now() + selectedProduct.lock_days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('staking_orders').insert({
        user_id: profile.id,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: numAmount,
        apy: selectedProduct.apy,
        early_withdrawal_penalty: selectedProduct.early_withdrawal_penalty,
        lock_days: selectedProduct.lock_days,
        end_date: endDate,
        status: 'active',
      });
      if (error) throw error;
      toast.success('Funds locked successfully!');
      await refreshProfile();
      fetchOrders();
      setModalOpen(false);
      setAmount('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleClaim = async (orderId: string) => {
    if (processing) return;
    const order = stakingOrders.find(o => o.id === orderId);
    if (!order) return toast.error('Order not found');
    if (order.status !== 'active' || !order.isMatured) return toast.error('Cannot claim yet');
    setProcessing(true);
    try {
      await supabase.rpc('add_wallet_balance', {
        user_id: profile?.id,
        amount: order.maturityAmount,
      });
      await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'return',
        amount: order.maturityAmount,
        description: `Staking maturity for ${order.product_name}`,
        status: 'completed',
      });
      await supabase.from('staking_orders').update({ status: 'completed' }).eq('id', orderId);
      toast.success(`$${order.maturityAmount.toFixed(2)} credited to your wallet!`);
      await refreshProfile();
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
      setConfirmModal({ open: false, orderId: null, action: null });
    }
  };

  const handleWithdrawEarly = async (orderId: string) => {
    if (processing) return;
    const order = stakingOrders.find(o => o.id === orderId);
    if (!order) return toast.error('Order not found');
    if (order.status !== 'active' || order.isMatured) return toast.error('Cannot withdraw early');
    setProcessing(true);
    try {
      const returnAmount = order.returnAmount;
      console.log('Withdraw early: principal=', order.amount, 'penalty=', order.penaltyAmount, 'return=', returnAmount);
      await supabase.rpc('add_wallet_balance', {
        user_id: profile?.id,
        amount: returnAmount,
      });
      await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'withdrawal',
        amount: returnAmount,
        description: `Early withdrawal from staking (${order.product_name}) – penalty $${order.penaltyAmount.toFixed(2)} applied`,
        status: 'completed',
      });
      await supabase.from('staking_orders').update({ status: 'withdrawn_early' }).eq('id', orderId);
      toast.success(`Withdrawal successful! You received $${returnAmount.toFixed(2)} (penalty deducted).`);
      await refreshProfile();
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
      setConfirmModal({ open: false, orderId: null, action: null });
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const calcResult = useMemo(() => {
    if (!calcProduct || !calcAmount) return null;
    const principal = calcAmount;
    const apy = calcProduct.apy / 100;
    const days = calcProduct.lock_days;
    const interest = principal * (apy / 365) * days;
    const total = principal + interest;
    return { interest, total, dailyInterest: interest / days };
  }, [calcProduct, calcAmount]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">Locked Savings (Staking)</h1>
          <p className="text-gray-600 mt-2">
            Lock your funds for a fixed period and earn a guaranteed APY.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-green-50 px-4 py-2 rounded-full border border-green-200">
          <Wallet size={18} className="text-green-600" />
          <span>Wallet: <strong>{formatCurrency(profile?.wallet_balance || 0)}</strong></span>
        </div>
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-brand" />
            <h2 className="text-xl font-semibold">Calculate Your Staking Earnings</h2>
          </div>
          {showCalc ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showCalc && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Product</label>
                <select
                  value={calcProduct?.id || ''}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setCalcProduct(product || null);
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                <input
                  type="number"
                  min={calcProduct?.min_amount || 10}
                  max={calcProduct?.max_amount || 10000}
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Min: ${calcProduct?.min_amount} – Max: ${calcProduct?.max_amount || '∞'}
                </div>
              </div>
            </div>
            {calcResult && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-2 border border-gray-200">
                <p className="text-sm text-gray-500">Estimated Earnings</p>
                <p className="text-3xl font-bold text-brand">{formatCurrency(calcResult.total)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Interest</span>
                    <p className="font-semibold text-green-600">{formatCurrency(calcResult.interest)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Daily Interest</span>
                    <p className="font-semibold">{formatCurrency(calcResult.dailyInterest)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  * Estimates based on {calcProduct?.lock_days} days lock. Early withdrawal penalty applies.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold">{p.name}</h3>
            <p className="text-gray-600 text-sm mt-1">{p.description}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">APY</span><span className="font-semibold text-green-600">{p.apy}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Lock Period</span><span>{p.lock_days} days</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Min / Max</span><span>${p.min_amount} / ${p.max_amount || '∞'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Early Penalty</span><span>{p.early_withdrawal_penalty}%</span></div>
            </div>
            <button
              onClick={() => { setSelectedProduct(p); setModalOpen(true); }}
              className="mt-6 w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-xl transition"
            >
              Lock Funds
            </button>
          </div>
        ))}
      </div>

      {/* Staking Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-2">Lock Funds – {selectedProduct.name}</h2>
            <p className="text-sm text-gray-600 mb-4">APY: {selectedProduct.apy}% • Lock: {selectedProduct.lock_days} days</p>
            <form onSubmit={handleStake} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min={selectedProduct.min_amount}
                  max={selectedProduct.max_amount || undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand"
                  placeholder={`Min $${selectedProduct.min_amount}`}
                  required
                />
                {(() => {
                  const numAmount = parseFloat(amount) || 0;
                  const interest = numAmount * (selectedProduct.apy / 100) * (selectedProduct.lock_days / 365);
                  const total = numAmount + interest;
                  return (
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      <p>Principal: <strong>{formatCurrency(numAmount)}</strong></p>
                      <p>Interest: <strong className="text-green-600">+{formatCurrency(interest)}</strong></p>
                      <p className="font-semibold text-brand">Total at maturity: {formatCurrency(total)}</p>
                    </div>
                  );
                })()}
              </div>
              <button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition">Lock Now</button>
              <button type="button" onClick={() => setModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 py-2 rounded-xl">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Staking Orders Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-semibold mb-4">Your Locked Savings</h2>
        {stakingOrders.length === 0 ? (
          <p className="text-gray-500">No locked savings yet. Start staking above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Maturity</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Time Left</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {stakingOrders.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="p-3">{order.product_name}</td>
                    <td className="p-3">{formatCurrency(order.amount)}</td>
                    <td className="p-3">{order.status === 'active' || order.status === 'completed' ? formatCurrency(order.maturityAmount) : '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'active' && !order.isMatured ? 'bg-green-100 text-green-700' :
                        order.status === 'active' && order.isMatured ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status === 'active' && order.isMatured ? 'Ready to Claim' :
                         order.status === 'active' ? 'Active' : order.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{order.timeLeft}</td>
                    <td className="p-3 space-x-2">
                      {order.status === 'active' && order.isMatured && (
                        <button
                          onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'claim' })}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-xl text-xs"
                          disabled={processing}
                        >
                          Claim
                        </button>
                      )}
                      {order.status === 'active' && !order.isMatured && (
                        <button
                          onClick={() => setConfirmModal({ open: true, orderId: order.id, action: 'withdraw_early' })}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-xl text-xs"
                          disabled={processing}
                        >
                          Withdraw Early
                        </button>
                      )}
                      {order.status === 'completed' && (
                        <span className="text-xs text-gray-400">Completed</span>
                      )}
                      {order.status === 'withdrawn_early' && (
                        <span className="text-xs text-gray-400">Withdrawn Early</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && confirmModal.orderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              {confirmModal.action === 'claim' ? 'Claim Maturity' : 'Withdraw Early'}
            </h2>
            <p className="text-gray-600 mb-4">
              {confirmModal.action === 'claim'
                ? 'You will receive the full maturity amount in your wallet.'
                : 'Early withdrawal will apply a penalty. You will receive the remaining amount. Are you sure?'
              }
            </p>
            {confirmModal.action === 'withdraw_early' && (() => {
              const order = stakingOrders.find(o => o.id === confirmModal.orderId);
              if (!order) return null;
              return (
                <div className="bg-gray-50 p-4 rounded-xl space-y-1 text-sm">
                  <div className="flex justify-between"><span className="font-medium">Principal:</span> {formatCurrency(order.amount)}</div>
                  <div className="flex justify-between"><span className="font-medium">Penalty ({order.early_withdrawal_penalty}%):</span> <span className="text-red-600">-{formatCurrency(order.penaltyAmount)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-1"><span className="font-medium">You will receive:</span> <span className="text-green-600 font-bold">{formatCurrency(order.returnAmount)}</span></div>
                </div>
              );
            })()}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (confirmModal.action === 'claim') handleClaim(confirmModal.orderId!);
                  else if (confirmModal.action === 'withdraw_early') handleWithdrawEarly(confirmModal.orderId!);
                }}
                disabled={processing}
                className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-xl transition disabled:opacity-70"
              >
                {processing ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmModal({ open: false, orderId: null, action: null })}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}