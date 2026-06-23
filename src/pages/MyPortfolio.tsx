import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Clock, TrendingUp, Wallet, Lock, Building } from 'lucide-react';

interface Order {
  id: string;
  type: 'investment' | 'staking' | 'property';
  product_name: string;
  amount: number;
  daily_return?: number; // for investments
  apy?: number; // for staking
  duration_days?: number;
  lock_days?: number;
  start_date: string;
  end_date: string;
  status: string;
  maturityAmount?: number;
  timeLeft: string;
  nextPayout: string;
}

export default function MyPortfolio() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [payoutTime, setPayoutTime] = useState<string>('12:00:00');
  const [countdowns, setCountdowns] = useState<{ [key: string]: { expiry: string; nextPayout: string } }>({});

  useEffect(() => {
    if (profile) {
      fetchPayoutTime();
      fetchAll();
    }
  }, [profile, filter]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateCountdowns();
    }, 1000);
    return () => clearInterval(interval);
  }, [items]);

  const fetchPayoutTime = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'payout_time')
      .single();
    if (data) setPayoutTime(data.value);
  };

  const fetchAll = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch investments (orders)
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', profile.id);
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      const { data: orders, error: ordersErr } = await query.order('created_at', { ascending: false });
      if (ordersErr) console.error(ordersErr);

      // Fetch staking orders
      let stakingQuery = supabase
        .from('staking_orders')
        .select('*')
        .eq('user_id', profile.id);
      if (filter !== 'all') {
        stakingQuery = stakingQuery.eq('status', filter);
      }
      const { data: staking, error: stakingErr } = await stakingQuery.order('created_at', { ascending: false });
      if (stakingErr) console.error(stakingErr);

      // Fetch property investments
      let propQuery = supabase
        .from('property_investments')
        .select('*, property:property_id(title)')
        .eq('user_id', profile.id);
      if (filter !== 'all') {
        propQuery = propQuery.eq('status', filter);
      }
      const { data: properties, error: propErr } = await propQuery.order('created_at', { ascending: false });
      if (propErr) console.error(propErr);

      // Combine
      const allItems: Order[] = [];

      orders?.forEach((o) => {
        allItems.push({
          id: o.id,
          type: 'investment',
          product_name: o.product_name,
          amount: o.amount,
          daily_return: o.daily_return,
          duration_days: o.duration_days,
          start_date: o.start_date,
          end_date: o.end_date,
          status: o.status,
          timeLeft: '--',
          nextPayout: '--',
        });
      });

      staking?.forEach((s) => {
        const maturity = s.amount * (1 + (s.apy / 100) * (s.lock_days / 365));
        allItems.push({
          id: s.id,
          type: 'staking',
          product_name: s.product_name || 'Staking',
          amount: s.amount,
          apy: s.apy,
          lock_days: s.lock_days,
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
          maturityAmount: maturity,
          timeLeft: '--',
          nextPayout: '--',
        });
      });

      properties?.forEach((p) => {
        allItems.push({
          id: p.id,
          type: 'property',
          product_name: p.property?.title || 'Property',
          amount: p.amount_paid,
          start_date: p.created_at,
          end_date: null, // no end date for property
          status: p.status,
          timeLeft: '--',
          nextPayout: '--',
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

  const updateCountdowns = (itemsData = items) => {
    const now = new Date().getTime();
    const newCountdowns: { [key: string]: { expiry: string; nextPayout: string } } = {};
    itemsData.forEach((item) => {
      if (!item.end_date) {
        newCountdowns[item.id] = { expiry: '—', nextPayout: '—' };
        return;
      }
      const end = new Date(item.end_date).getTime();
      const diffExpiry = Math.max(0, end - now);
      const days = Math.floor(diffExpiry / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffExpiry % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diffExpiry % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diffExpiry % (60 * 1000)) / 1000);
      const expiryStr = days > 0 ? `${days}d ${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m ${seconds}s`;

      // Next payout (only for active investments and staking)
      let payoutStr = '—';
      if (item.type === 'investment' && item.status === 'active') {
        const [payoutHour, payoutMinute] = payoutTime.split(':').map(Number);
        const nowDate = new Date();
        let nextPayoutDate = new Date(nowDate);
        nextPayoutDate.setHours(payoutHour, payoutMinute, 0, 0);
        if (nextPayoutDate <= nowDate) {
          nextPayoutDate.setDate(nextPayoutDate.getDate() + 1);
        }
        const diffPayout = Math.max(0, nextPayoutDate.getTime() - now);
        const pHours = Math.floor(diffPayout / (60 * 60 * 1000));
        const pMinutes = Math.floor((diffPayout % (60 * 60 * 1000)) / (60 * 1000));
        const pSeconds = Math.floor((diffPayout % (60 * 1000)) / 1000);
        payoutStr = `${pHours}h ${pMinutes}m ${pSeconds}s`;
      } else if (item.type === 'staking' && item.status === 'active') {
        // For staking, show countdown to maturity
        payoutStr = expiryStr;
      }

      newCountdowns[item.id] = { expiry: expiryStr, nextPayout: payoutStr };
    });
    setCountdowns(newCountdowns);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const totalInvested = items.reduce((sum, o) => sum + o.amount, 0);
  const totalReturns = items
    .filter(o => (o.type === 'investment' && (o.status === 'active' || o.status === 'completed')))
    .reduce((sum, o) => sum + (o.amount * (1 + (o.daily_return || 0) / 100 * (o.duration_days || 0))), 0) - totalInvested;

  if (loading) return <div className="p-8 text-center">Loading your portfolio...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent mb-6">My Portfolio</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 border border-gray-100">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Wallet size={24} /></div>
          <div><p className="text-sm text-gray-500">Total Invested</p><p className="text-xl font-bold">{formatCurrency(totalInvested)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 border border-gray-100">
          <div className="p-3 bg-green-100 rounded-xl text-green-600"><TrendingUp size={24} /></div>
          <div><p className="text-sm text-gray-500">Total Returns</p><p className="text-xl font-bold text-green-600">{formatCurrency(totalReturns)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 border border-gray-100">
          <div className="p-3 bg-purple-100 rounded-xl text-purple-600"><Clock size={24} /></div>
          <div><p className="text-sm text-gray-500">Active Investments</p><p className="text-xl font-bold">{items.filter(o => o.status === 'active').length}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 border border-gray-100">
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600"><Lock size={24} /></div>
          <div><p className="text-sm text-gray-500">Locked Savings</p><p className="text-xl font-bold">{items.filter(o => o.type === 'staking' && o.status === 'active').length}</p></div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {['all', 'active', 'pending', 'completed', 'cancelled', 'withdrawn_early'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === s ? 'bg-brand text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="text-left p-4 font-semibold">Type</th>
                <th className="text-left p-4 font-semibold">Name</th>
                <th className="text-left p-4 font-semibold">Amount</th>
                <th className="text-left p-4 font-semibold">Return %</th>
                <th className="text-left p-4 font-semibold">Duration</th>
                <th className="text-left p-4 font-semibold">Start</th>
                <th className="text-left p-4 font-semibold">End</th>
                <th className="text-left p-4 font-semibold">Expiry</th>
                <th className="text-left p-4 font-semibold">Next Payout</th>
                <th className="text-left p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cd = countdowns[item.id] || { expiry: '--', nextPayout: '--' };
                const returnPct = item.type === 'investment' ? `${item.daily_return || 0}% daily` :
                                  item.type === 'staking' ? `${item.apy || 0}% APY` :
                                  '—';
                const duration = item.type === 'investment' ? `${item.duration_days || 0}d` :
                                item.type === 'staking' ? `${item.lock_days || 0}d` :
                                '—';
                return (
                  <tr key={item.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.type === 'investment' ? 'bg-blue-100 text-blue-700' :
                        item.type === 'staking' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium">{item.product_name}</td>
                    <td className="p-4">{formatCurrency(item.amount)}</td>
                    <td className="p-4">{returnPct}</td>
                    <td className="p-4">{duration}</td>
                    <td className="p-4">{new Date(item.start_date).toLocaleDateString()}</td>
                    <td className="p-4">{item.end_date ? new Date(item.end_date).toLocaleDateString() : '—'}</td>
                    <td className="p-4 font-mono text-xs">{cd.expiry}</td>
                    <td className="p-4 font-mono text-xs text-brand">{cd.nextPayout}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'active' ? 'bg-green-100 text-green-700' :
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        item.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'withdrawn_early' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <p className="p-8 text-gray-500 text-center">No investments yet.</p>}
      </div>
    </div>
  );
}