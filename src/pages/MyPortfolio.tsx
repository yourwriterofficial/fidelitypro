import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Clock, TrendingUp, Wallet, Lock, BarChart2, Building2 } from 'lucide-react';

interface Order {
  id: string; type: 'investment' | 'staking' | 'property';
  product_name: string; amount: number;
  daily_return?: number; apy?: number;
  duration_days?: number; lock_days?: number;
  start_date: string; end_date?: string; status: string;
  maturityAmount?: number; timeLeft: string; nextPayout: string;
}

const TYPE_CONFIG = {
  investment: { label: 'Investment', icon: <TrendingUp size={13} />, style: 'bg-blue-50 text-blue-700 border-blue-100' },
  staking:    { label: 'Staking',    icon: <Lock      size={13} />, style: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  property:   { label: 'Property',   icon: <Building2 size={13} />, style: 'bg-amber-50 text-amber-700 border-amber-100' },
};

const STATUS_CONFIG: Record<string, string> = {
  active:          'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending:         'bg-amber-50 text-amber-700 border-amber-100',
  completed:       'bg-blue-50 text-blue-700 border-blue-100',
  cancelled:       'bg-red-50 text-red-700 border-red-100',
  withdrawn_early: 'bg-gray-50 text-gray-600 border-gray-100',
};

const FILTERS = ['all', 'active', 'pending', 'completed', 'cancelled', 'withdrawn_early'];

export default function MyPortfolio() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [payoutTime, setPayoutTime] = useState('12:00:00');
  const [countdowns, setCountdowns] = useState<{ [key: string]: { expiry: string; nextPayout: string } }>({});

  useEffect(() => {
    if (profile) { fetchPayoutTime(); fetchAll(); }
  }, [profile, filter]);

  useEffect(() => {
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [items]);

  const fetchPayoutTime = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'payout_time').single();
    if (data) setPayoutTime(data.value);
  };

  const fetchAll = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let query = supabase.from('orders').select('*').eq('user_id', profile.id);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data: orders } = await query.order('created_at', { ascending: false });

      let stakingQ = supabase.from('staking_orders').select('*').eq('user_id', profile.id);
      if (filter !== 'all') stakingQ = stakingQ.eq('status', filter);
      const { data: staking } = await stakingQ.order('created_at', { ascending: false });

      let propQ = supabase.from('property_investments').select('*, property:property_id(title)').eq('user_id', profile.id);
      if (filter !== 'all') propQ = propQ.eq('status', filter);
      const { data: properties } = await propQ.order('created_at', { ascending: false });

      const allItems: Order[] = [];
      orders?.forEach(o => allItems.push({ id: o.id, type: 'investment', product_name: o.product_name, amount: o.amount, daily_return: o.daily_return, duration_days: o.duration_days, start_date: o.start_date, end_date: o.end_date, status: o.status, timeLeft: '--', nextPayout: '--' }));
      staking?.forEach(s => {
        const maturity = s.amount * (1 + (s.apy / 100) * (s.lock_days / 365));
        allItems.push({ id: s.id, type: 'staking', product_name: s.product_name || 'Staking', amount: s.amount, apy: s.apy, lock_days: s.lock_days, start_date: s.start_date, end_date: s.end_date, status: s.status, maturityAmount: maturity, timeLeft: '--', nextPayout: '--' });
      });
      properties?.forEach(p => allItems.push({ id: p.id, type: 'property', product_name: p.property?.title || 'Property', amount: p.amount_paid, start_date: p.created_at, end_date: '', status: p.status, timeLeft: '--', nextPayout: '--' }));

      setItems(allItems);
      updateCountdowns(allItems);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateCountdowns = (itemsData = items) => {
    const now = Date.now();
    const newCD: { [key: string]: { expiry: string; nextPayout: string } } = {};
    itemsData.forEach(item => {
      if (!item.end_date) { newCD[item.id] = { expiry: '—', nextPayout: '—' }; return; }
      const end = new Date(item.end_date).getTime();
      const diff = Math.max(0, end - now);
      const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
      const expiryStr = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`;
      let payoutStr = '—';
      if (item.type === 'investment' && item.status === 'active') {
        const [ph, pm] = payoutTime.split(':').map(Number);
        const next = new Date(); next.setHours(ph, pm, 0, 0);
        if (next <= new Date()) next.setDate(next.getDate() + 1);
        const dp = Math.max(0, next.getTime() - now);
        const ppH = Math.floor(dp / 36e5), ppM = Math.floor((dp % 36e5) / 6e4), ppS = Math.floor((dp % 6e4) / 1e3);
        payoutStr = `${ppH}h ${ppM}m ${ppS}s`;
      } else if (item.type === 'staking' && item.status === 'active') { payoutStr = expiryStr; }
      newCD[item.id] = { expiry: expiryStr, nextPayout: payoutStr };
    });
    setCountdowns(newCD);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const totalInvested = items.reduce((s, o) => s + o.amount, 0);
  const totalReturns = items.filter(o => o.type === 'investment' && ['active', 'completed'].includes(o.status))
    .reduce((s, o) => s + (o.amount * (1 + (o.daily_return || 0) / 100 * (o.duration_days || 0))), 0) - totalInvested;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Portfolio</h1>
        <p className="text-gray-500 text-sm mt-0.5">All your investments, savings, and properties in one place.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: <Wallet   size={20} className="text-blue-600" />,   label: 'Total Invested',    value: fmt(totalInvested),   bg: 'bg-blue-50' },
          { icon: <TrendingUp size={20} className="text-emerald-600" />, label: 'Est. Returns',   value: fmt(totalReturns),    bg: 'bg-emerald-50' },
          { icon: <Clock    size={20} className="text-purple-600" />, label: 'Active Investments', value: String(items.filter(o => o.status === 'active').length), bg: 'bg-purple-50' },
          { icon: <Lock     size={20} className="text-indigo-600" />, label: 'Locked Savings',    value: String(items.filter(o => o.type === 'staking' && o.status === 'active').length), bg: 'bg-indigo-50' },
        ].map(({ icon, label, value, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${bg}`}>{icon}</div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all border ${
              filter === s
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:border-brand hover:text-brand'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart2 size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No investments found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Type', 'Name', 'Amount', 'Return %', 'Duration', 'Start', 'End', 'Time Left', 'Next Payout', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const cd = countdowns[item.id] || { expiry: '--', nextPayout: '--' };
                  const typeCfg = TYPE_CONFIG[item.type];
                  const returnPct = item.type === 'investment' ? `${item.daily_return || 0}% /day`
                    : item.type === 'staking' ? `${item.apy || 0}% APY` : '—';
                  const duration = item.type === 'investment' ? `${item.duration_days || 0}d`
                    : item.type === 'staking' ? `${item.lock_days || 0}d` : '—';
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${typeCfg.style}`}>
                          {typeCfg.icon} {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-gray-900 whitespace-nowrap">{item.product_name}</td>
                      <td className="px-4 py-3.5 tabular-nums">{fmt(item.amount)}</td>
                      <td className="px-4 py-3.5 text-emerald-600 font-medium">{returnPct}</td>
                      <td className="px-4 py-3.5 text-gray-500">{duration}</td>
                      <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">{new Date(item.start_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">{item.end_date ? new Date(item.end_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-600">{cd.expiry}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-brand font-medium">{cd.nextPayout}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[item.status] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
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
