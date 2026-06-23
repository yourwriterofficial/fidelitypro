import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Wallet, TrendingUp, DollarSign, Activity, Bell, Lock, Building, PieChart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useAnnouncements } from '../hooks/useAnnouncements';
import InactivityBanner from '../components/InactivityBanner';

export default function Dashboard() {
  const { profile, refreshProfile, isImpersonating } = useAuthStore();
  const { data: announcements = [] } = useAnnouncements();
  const [investments, setInvestments] = useState<any[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stakingTotal, setStakingTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [totalPortfolio, setTotalPortfolio] = useState(0);

  useEffect(() => {
    refreshProfile();
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Active investments (orders)
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'active');
      setInvestments(orders || []);
      const invested = orders?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
      setTotalInvested(invested);
      const total = orders?.reduce((sum, inv) => sum + (inv.amount * (1 + inv.daily_return/100 * inv.duration_days)), 0) || 0;
      setTotalReturns(total - invested);

      // 2. Staking active
      const { data: staking } = await supabase
        .from('staking_orders')
        .select('amount')
        .eq('user_id', profile.id)
        .eq('status', 'active');
      const stakingSum = staking?.reduce((s, o) => s + o.amount, 0) || 0;
      setStakingTotal(stakingSum);

      // 3. Property active
      const { data: props } = await supabase
        .from('property_investments')
        .select('amount_paid')
        .eq('user_id', profile.id)
        .eq('status', 'active');
      const propSum = props?.reduce((s, p) => s + p.amount_paid, 0) || 0;
      setPropertyTotal(propSum);

      // 4. Total portfolio value = wallet + invested + staking + property paid
      const wallet = profile.wallet_balance || 0;
      setTotalPortfolio(wallet + invested + stakingSum + propSum);

      // 5. Build real chart data from transactions (last 7 days)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(30);

      if (transactions && transactions.length > 0) {
        // Aggregate by day
        const dayMap: { [key: string]: number } = {};
        let runningBalance = 0;
        // Use last 7 days
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('en-US', { weekday: 'short' });
          dayMap[key] = 0;
        }
        transactions.forEach(t => {
          const date = new Date(t.created_at).toLocaleDateString('en-US', { weekday: 'short' });
          if (dayMap[date] !== undefined) {
            dayMap[date] += t.amount;
          }
        });
        // Convert to array and cumulative
        const chartArray = Object.keys(dayMap).map(day => ({ day, value: 0 }));
        let cum = 0;
        chartArray.forEach((item, index) => {
          cum += dayMap[item.day] || 0;
          chartArray[index].value = cum;
        });
        setChartData(chartArray);
      } else {
        // Fallback mock chart
        setChartData([
          { day: 'Mon', value: 0 },
          { day: 'Tue', value: 200 },
          { day: 'Wed', value: 450 },
          { day: 'Thu', value: 600 },
          { day: 'Fri', value: 820 },
          { day: 'Sat', value: 1050 },
          { day: 'Sun', value: 1250 },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <InactivityBanner />
      {isImpersonating && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-800 text-sm">
          You are impersonating {profile.email}. <button onClick={() => useAuthStore.getState().clearImpersonation()} className="underline">Stop</button>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bell size={18} /> Announcements</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {announcements.map((a) => (
              <div key={a.id} className={`p-3 rounded-xl ${a.is_pinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-gray-600">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl text-brand"><Wallet size={22} /></div>
          <div><p className="text-xs text-gray-500">Balance</p><p className="text-lg font-bold">{formatCurrency(profile.wallet_balance || 0)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><TrendingUp size={22} /></div>
          <div><p className="text-xs text-gray-500">Invested</p><p className="text-lg font-bold">{formatCurrency(totalInvested)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl text-purple-600"><DollarSign size={22} /></div>
          <div><p className="text-xs text-gray-500">Returns</p><p className="text-lg font-bold">{formatCurrency(totalReturns)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><PieChart size={22} /></div>
          <div><p className="text-xs text-gray-500">Portfolio</p><p className="text-lg font-bold">{formatCurrency(totalPortfolio)}</p></div>
        </div>
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Portfolio Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => `$${v}`} />
              <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Portfolio Breakdown</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-gray-600">Wallet</span>
              <span className="font-medium">{formatCurrency(profile.wallet_balance || 0)}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-gray-600">Investments</span>
              <span className="font-medium">{formatCurrency(totalInvested)}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-gray-600">Locked Savings</span>
              <span className="font-medium">{formatCurrency(stakingTotal)}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-gray-600">Properties</span>
              <span className="font-medium">{formatCurrency(propertyTotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-brand">{formatCurrency(totalPortfolio)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Investments Table */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Active Investments</h2>
        {loading ? (
          <p>Loading...</p>
        ) : investments.length === 0 ? (
          <p className="text-gray-500">No active investments. <Link to="/app/invest" className="text-brand hover:underline">Start investing now</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Plan</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Daily Return</th>
                  <th className="text-left p-3">Duration</th>
                  <th className="text-left p-3">Start</th>
                  <th className="text-left p-3">End</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3 font-medium">{inv.product_name}</td>
                    <td className="p-3">{formatCurrency(inv.amount)}</td>
                    <td className="p-3">{inv.daily_return}%</td>
                    <td className="p-3">{inv.duration_days} d</td>
                    <td className="p-3">{new Date(inv.start_date).toLocaleDateString()}</td>
                    <td className="p-3">{new Date(inv.end_date).toLocaleDateString()}</td>
                    <td className="p-3"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span></td>
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