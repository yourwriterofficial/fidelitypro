import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { 
  RefreshCw, Check, X, Search, Plus, Edit2, Lock
} from 'lucide-react';

interface P2POrder {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  order_type: string;
  source_asset: string;
  target_asset: string;
  target_currency_symbol: string;
  amount_usd: number;
  target_amount: number;
  exchange_rate: number;
  merchant_name: string;
  payment_method: string;
  destination_account_or_address: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface P2PMerchant {
  id: string;
  name: string;
  asset: string;
  currency: string;
  rate: number;
  min_limit: number;
  max_limit: number;
  payment_methods: string[];
  completion_rate: number;
  total_orders: number;
  avg_release_mins: number;
  is_verified: boolean;
  is_active: boolean;
}

export default function AdminP2P() {
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [merchants, setMerchants] = useState<P2PMerchant[]>([]);
  const [filter, setFilter] = useState<'all' | 'escrow_locked' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  // New Merchant Modal
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<P2PMerchant | null>(null);
  const [mName, setMName] = useState('');
  const [mAsset, setMAsset] = useState('USDT');
  const [mCurrency, setMCurrency] = useState('USDT (TRC20/ERC20)');
  const [mRate, setMRate] = useState('1.00');
  const [mMin, setMMin] = useState('100000');
  const [mMax, setMMax] = useState('5000000');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('p2p_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setOrders(data as P2POrder[]);
    } catch (err) {
      console.warn('Failed loading orders:', err);
    }
  };

  const fetchMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('p2p_merchants')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setMerchants(data as P2PMerchant[]);
    } catch (err) {
      console.warn('Failed loading merchants:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchMerchants();
  }, []);

  const handleCompleteOrder = async (order: P2POrder) => {
    if (!confirm(`Mark P2P Order ${order.id.slice(0, 8)} as COMPLETED? This confirms the bank wire/crypto was dispatched to the client.`)) return;
    setActionId(order.id);
    try {
      const { error } = await supabase
        .from('p2p_orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;

      // Notify User
      try {
        await supabase.from('messages').insert({
          user_id: order.user_id,
          sender_id: order.user_id,
          body: `[P2P Order Completed] Your conversion of $${order.amount_usd.toLocaleString()} to ${order.target_amount.toLocaleString()} ${order.target_currency_symbol} has been fully settled and released to: ${order.destination_account_or_address}.`,
          read: false,
        });
      } catch (_) {}

      toast.success('P2P Order marked as Completed!');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete order');
    } finally {
      setActionId(null);
    }
  };

  const handleCancelAndRefund = async (order: P2POrder) => {
    if (!confirm(`Cancel P2P Order ${order.id.slice(0, 8)} and REFUND ${fmt(order.amount_usd)} back to user's wallet?`)) return;
    setActionId(order.id);
    try {
      // Refund balance
      await supabase.rpc('increment_wallet_balance', { user_id: order.user_id, amount: order.amount_usd });

      // Update Order Status
      await supabase
        .from('p2p_orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: order.user_id,
        type: 'deposit',
        amount: order.amount_usd,
        description: `P2P Escrow Refund: Order #${order.id.slice(0, 8)} cancelled`,
        status: 'completed',
      });

      // Notify User
      try {
        await supabase.from('messages').insert({
          user_id: order.user_id,
          sender_id: order.user_id,
          body: `[P2P Escrow Refunded] Order #${order.id.slice(0, 8)} has been cancelled and $${order.amount_usd.toLocaleString()} USD has been returned to your RPM wallet balance.`,
          read: false,
        });
      } catch (_) {}

      toast.success('Order cancelled and funds refunded to user wallet!');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to refund order');
    } finally {
      setActionId(null);
    }
  };

  const handleSaveMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(mRate);
    const min = parseFloat(mMin);
    const max = parseFloat(mMax);
    if (!mName.trim() || isNaN(rate)) {
      toast.error('Please enter a valid merchant name and rate');
      return;
    }

    try {
      if (editingMerchant) {
        const { error } = await supabase
          .from('p2p_merchants')
          .update({
            name: mName.trim(),
            asset: mAsset,
            currency: mCurrency,
            rate: rate,
            min_limit: min,
            max_limit: max,
          })
          .eq('id', editingMerchant.id);
        if (error) throw error;
        toast.success('Merchant updated!');
      } else {
        const { error } = await supabase.from('p2p_merchants').insert({
          name: mName.trim(),
          asset: mAsset,
          currency: mCurrency,
          rate: rate,
          min_limit: min,
          max_limit: max,
          payment_methods: ['Bank Transfer', 'Crypto Wallet'],
          completion_rate: 99.8,
          total_orders: 1500,
          avg_release_mins: 15,
          is_verified: true,
          is_active: true,
        });
        if (error) throw error;
        toast.success('New P2P OTC Merchant added!');
      }
      setShowMerchantModal(false);
      setEditingMerchant(null);
      fetchMerchants();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save merchant');
    }
  };

  const filteredOrders = orders.filter(ord => {
    const matchesFilter = filter === 'all' || ord.status === filter;
    const matchesSearch = 
      (ord.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (ord.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (ord.destination_account_or_address || '').toLowerCase().includes(search.toLowerCase()) ||
      ord.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P2P Escrow & OTC Desk Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review live $100k+ P2P conversion requests, release escrow, and manage verified institutional merchants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingMerchant(null);
              setMName('');
              setMAsset('USDT');
              setMCurrency('USDT (TRC20/ERC20)');
              setMRate('1.00');
              setMMin('100000');
              setMMax('5000000');
              setShowMerchantModal(true);
            }}
            className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5"
          >
            <Plus size={15} /> Add OTC Merchant
          </button>
          <button onClick={() => { fetchOrders(); fetchMerchants(); }} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Orders Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Live P2P Conversion Orders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Minimum $100,000 USD institutional orders.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search user, email, address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium"
              />
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {(['all', 'escrow_locked', 'completed', 'cancelled'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition capitalize ${
                    filter === f ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <p className="p-12 text-center text-sm text-gray-400">No P2P orders match current criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['User / Email', 'Amount Locked', 'Receiving', 'Destination Account / Address', 'Merchant', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-4">
                      <p className="font-bold text-gray-900 text-xs">{ord.user_name || 'User'}</p>
                      <p className="text-[11px] text-gray-400">{ord.user_email}</p>
                      <span className="text-[10px] font-mono text-gray-400 block mt-0.5">#{ord.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-gray-900 tabular-nums">{fmt(ord.amount_usd)}</td>
                    <td className="px-4 py-4 font-extrabold text-emerald-600 tabular-nums">
                      {ord.target_amount.toLocaleString()} {ord.target_currency_symbol}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-gray-700 max-w-[220px] break-all">
                      {ord.destination_account_or_address}
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-gray-800">{ord.merchant_name}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border uppercase text-[10px] tracking-wider ${
                        ord.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ord.status === 'escrow_locked'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        <Lock size={10} />
                        {ord.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {ord.status === 'escrow_locked' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCompleteOrder(ord)}
                            disabled={actionId === ord.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-60 flex items-center gap-1"
                            title="Mark Completed"
                          >
                            <Check size={12} /> Release
                          </button>
                          <button
                            onClick={() => handleCancelAndRefund(ord)}
                            disabled={actionId === ord.id}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition border border-red-200 disabled:opacity-60 flex items-center gap-1"
                            title="Cancel and Refund Escrow"
                          >
                            <X size={12} /> Refund
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merchants Management Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Institutional OTC Merchants</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configured liquidity desks available to users in P2P.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                {['Merchant Name', 'Asset', 'Currency Code', 'Rate ($)', 'Limits (Min - Max)', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {merchants.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-4 font-bold text-gray-900">{m.name}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-indigo-600">{m.asset}</td>
                  <td className="px-4 py-4 text-xs text-gray-700">{m.currency}</td>
                  <td className="px-4 py-4 font-bold text-emerald-600 tabular-nums">${m.rate.toFixed(2)}</td>
                  <td className="px-4 py-4 text-xs text-gray-600 tabular-nums">{fmt(m.min_limit)} - {fmt(m.max_limit)}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase">
                      {m.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => {
                        setEditingMerchant(m);
                        setMName(m.name);
                        setMAsset(m.asset);
                        setMCurrency(m.currency);
                        setMRate(m.rate.toString());
                        setMMin(m.min_limit.toString());
                        setMMax(m.max_limit.toString());
                        setShowMerchantModal(true);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition"
                      title="Edit Merchant"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Merchant Edit Modal */}
      {showMerchantModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                {editingMerchant ? 'Edit OTC Merchant' : 'Add New OTC Merchant'}
              </h3>
              <button onClick={() => setShowMerchantModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMerchant} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Merchant Name</label>
                <input
                  type="text"
                  value={mName}
                  onChange={e => setMName(e.target.value)}
                  placeholder="e.g. Apex OTC Settlements"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Asset Code</label>
                  <input
                    type="text"
                    value={mAsset}
                    onChange={e => setMAsset(e.target.value)}
                    placeholder="e.g. USDT"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Rate ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={mRate}
                    onChange={e => setMRate(e.target.value)}
                    placeholder="1.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Display Currency / Networks</label>
                <input
                  type="text"
                  value={mCurrency}
                  onChange={e => setMCurrency(e.target.value)}
                  placeholder="e.g. USDT (TRC20/ERC20)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Min Limit ($)</label>
                  <input
                    type="number"
                    value={mMin}
                    onChange={e => setMMin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Max Limit ($)</label>
                  <input
                    type="number"
                    value={mMax}
                    onChange={e => setMMax(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center"
                >
                  Save Merchant
                </button>
                <button
                  type="button"
                  onClick={() => setShowMerchantModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
