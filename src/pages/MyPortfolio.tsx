import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import {
  TrendingUp, Lock, Building, ArrowLeftRight, PieChart
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PortfolioItem {
  id: string;
  type: 'investment' | 'staking' | 'property' | 'p2p';
  product_name: string;
  amount: number;
  daily_return?: number;
  apy?: number;
  duration_days?: number;
  lock_days?: number;
  start_date: string;
  end_date?: string;
  status: string;
  maturityAmount?: number;
  timeLeft: string;
  nextPayout: string;
  details?: string;
}

const TYPE_CONFIG = {
  property:   { label: 'Property Deed',  icon: <Building size={13} />,       style: 'bg-amber-50 text-amber-800 border-amber-200' },
  staking:    { label: 'Locked Savings', icon: <Lock size={13} />,           style: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  investment: { label: 'ROI Plan',       icon: <TrendingUp size={13} />,     style: 'bg-brand/10 text-brand border-brand/20' },
  p2p:        { label: 'P2P Escrow',     icon: <ArrowLeftRight size={13} />, style: 'bg-teal-50 text-teal-800 border-teal-200' },
};

const STATUS_CONFIG: Record<string, string> = {
  active:          'bg-emerald-50 text-brand border-emerald-200 font-semibold',
  escrow_locked:   'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
  pending:         'bg-amber-50 text-amber-800 border-amber-200',
  completed:       'bg-blue-50 text-blue-700 border-blue-200',
  cancelled:       'bg-red-50 text-red-700 border-red-200',
  withdrawn_early: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function MyPortfolio() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'property' | 'staking' | 'investment' | 'p2p'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payoutTime, setPayoutTime] = useState('12:00:00');
  const [countdowns, setCountdowns] = useState<{ [key: string]: { expiry: string; nextPayout: string } }>({});

  const fetchPayoutTime = async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'payout_time').single();
      if (data) setPayoutTime(data.value);
    } catch (_) {}
  };

  const updateCountdowns = (itemsData = items) => {
    const now = Date.now();
    const newCD: { [key: string]: { expiry: string; nextPayout: string } } = {};
    itemsData.forEach(item => {
      if (!item.end_date) {
        newCD[item.id] = { expiry: 'Perpetual', nextPayout: item.type === 'property' ? 'Monthly' : '—' };
        return;
      }
      const end = new Date(item.end_date).getTime();
      const diff = Math.max(0, end - now);
      const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
      const expiryStr = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`;
      
      let payoutStr = '—';
      if (item.type === 'investment' && item.status === 'active') {
        const [ph, pm] = payoutTime.split(':').map(Number);
        const next = new Date();
        next.setHours(ph || 12, pm || 0, 0, 0);
        if (next <= new Date()) next.setDate(next.getDate() + 1);
        const dp = Math.max(0, next.getTime() - now);
        const ppH = Math.floor(dp / 36e5), ppM = Math.floor((dp % 36e5) / 6e4), ppS = Math.floor((dp % 6e4) / 1e3);
        payoutStr = `${ppH}h ${ppM}m ${ppS}s`;
      } else if (item.type === 'staking' && item.status === 'active') {
        payoutStr = expiryStr;
      }
      newCD[item.id] = { expiry: expiryStr, nextPayout: payoutStr };
    });
    setCountdowns(newCD);
  };

  const fetchAll = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Orders / Investments
      let query = supabase.from('orders').select('*').eq('user_id', profile.id);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data: orders } = await query.order('created_at', { ascending: false });

      // 2. Staking
      let stakingQ = supabase.from('staking_orders').select('*').eq('user_id', profile.id);
      if (statusFilter !== 'all') stakingQ = stakingQ.eq('status', statusFilter);
      const { data: staking } = await stakingQ.order('created_at', { ascending: false });

      // 3. Properties
      let propQ = supabase.from('property_investments').select('*, property:property_id(title, yield_rate)').eq('user_id', profile.id);
      if (statusFilter !== 'all') propQ = propQ.eq('status', statusFilter);
      const { data: properties } = await propQ.order('created_at', { ascending: false });

      // 4. P2P Orders
      let p2pQ = supabase.from('p2p_orders').select('*').eq('user_id', profile.id);
      if (statusFilter !== 'all') p2pQ = p2pQ.eq('status', statusFilter);
      const { data: p2pOrders } = await p2pQ.order('created_at', { ascending: false });

      const allItems: PortfolioItem[] = [];

      // Add Properties
      properties?.forEach(p => {
        allItems.push({
          id: p.id,
          type: 'property',
          product_name: p.property?.title || 'Real Estate Fractional Share',
          amount: p.amount_paid,
          start_date: p.created_at,
          end_date: '',
          status: p.status,
          timeLeft: 'Perpetual',
          nextPayout: 'Monthly Yield',
          details: `${p.shares_count || 1} Shares Owned`,
        });
      });

      // Add Staking
      staking?.forEach(s => {
        const maturity = s.amount * (1 + (s.apy / 100) * (s.lock_days / 365));
        allItems.push({
          id: s.id,
          type: 'staking',
          product_name: s.product_name || `Fixed Lock ${s.lock_days}d`,
          amount: s.amount,
          apy: s.apy,
          lock_days: s.lock_days,
          start_date: s.start_date || s.created_at,
          end_date: s.end_date,
          status: s.status,
          maturityAmount: maturity,
          timeLeft: '--',
          nextPayout: '--',
        });
      });

      // Add Investments
      orders?.forEach(o => {
        allItems.push({
          id: o.id,
          type: 'investment',
          product_name: o.product_name,
          amount: o.amount,
          daily_return: o.daily_return,
          duration_days: o.duration_days,
          start_date: o.start_date || o.created_at,
          end_date: o.end_date,
          status: o.status,
          timeLeft: '--',
          nextPayout: '--',
        });
      });

      // Add P2P
      p2pOrders?.forEach(ord => {
        allItems.push({
          id: ord.id,
          type: 'p2p',
          product_name: `OTC Conversion to ${ord.target_currency_symbol}`,
          amount: ord.amount_usd,
          start_date: ord.created_at,
          end_date: ord.created_at,
          status: ord.status,
          timeLeft: 'Settling',
          nextPayout: '15m SLA',
          details: `To: ${ord.destination_account_or_address?.slice(0, 20)}...`,
        });
      });

      setItems(allItems);
      updateCountdowns(allItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchPayoutTime();
      fetchAll();
    }
  }, [profile, statusFilter]);

  useEffect(() => {
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [items]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const filteredItems = items.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    return true;
  });

  const propertyTotal = items.filter(i => i.type === 'property').reduce((s, i) => s + i.amount, 0);
  const stakingTotal = items.filter(i => i.type === 'staking' && i.status === 'active').reduce((s, i) => s + i.amount, 0);
  const investTotal = items.filter(i => i.type === 'investment' && i.status === 'active').reduce((s, i) => s + i.amount, 0);
  const totalInvested = propertyTotal + stakingTotal + investTotal;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Consolidated Asset Ledger
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            My Investment Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Unified tracking across Real Estate, Locked Savings, ROI Plans, and P2P Escrows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/properties"
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Building size={13} /> + Property
          </Link>
          <Link
            to="/app/staking"
            className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Lock size={13} /> + Staking
          </Link>
          <Link
            to="/app/invest"
            className="px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <TrendingUp size={13} /> + ROI Plan
          </Link>
        </div>
      </div>

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Active Capital</span>
            <div className="p-2 bg-brand/10 text-brand rounded-xl">
              <PieChart size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{fmt(totalInvested)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{items.filter(i => i.status === 'active').length} active positions</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Real Estate Equity</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Building size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-700 tabular-nums">{fmt(propertyTotal)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{items.filter(i => i.type === 'property').length} deeds held</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Locked Savings APY</span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Lock size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-indigo-700 tabular-nums">{fmt(stakingTotal)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{items.filter(i => i.type === 'staking' && i.status === 'active').length} active locks</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ROI Plans Active</span>
            <div className="p-2 bg-brand/10 text-brand rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-brand tabular-nums">{fmt(investTotal)}</p>
          <span className="text-xs text-gray-400 mt-1 block">Daily payouts active</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All Assets' },
            { key: 'property', label: 'Properties' },
            { key: 'staking', label: 'Locked Savings' },
            { key: 'investment', label: 'ROI Plans' },
            { key: 'p2p', label: 'P2P Escrows' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === t.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent text-gray-700 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="escrow_locked">Escrow Locked</option>
            <option value="completed">Completed</option>
            <option value="withdrawn_early">Withdrawn Early</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Portfolio Table */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-2xl" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center">
            <PieChart size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-bold text-sm">No positions found for this filter</p>
            <p className="text-xs text-gray-400 mt-1">Explore our product pillars to begin investing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Class</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Name</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Capital Amount</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate / APY</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time Remaining</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Settlement</th>
                  <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems.map(item => {
                  const cd = countdowns[item.id] || { expiry: '--', nextPayout: '--' };
                  const typeCfg = TYPE_CONFIG[item.type];
                  const returnPct = item.type === 'investment'
                    ? `${item.daily_return || 0}% /day`
                    : item.type === 'staking'
                    ? `${item.apy || 0}% APY`
                    : item.type === 'property'
                    ? 'Rental Yield'
                    : 'OTC Rate';

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${typeCfg.style}`}>
                          {typeCfg.icon} {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 block">{item.product_name}</span>
                        {item.details && <span className="text-[11px] text-gray-400">{item.details}</span>}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 tabular-nums">{fmt(item.amount)}</td>
                      <td className="px-6 py-4 font-extrabold text-brand tabular-nums">{returnPct}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(item.start_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-700">{cd.expiry}</td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-brand">{cd.nextPayout}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs border capitalize ${STATUS_CONFIG[item.status] || 'bg-gray-100 text-gray-700'}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
