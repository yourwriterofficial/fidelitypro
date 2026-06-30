import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { Wallet, TrendingUp, DollarSign, Bell, PieChart, ArrowRight, ArrowUpRight, Layers, Home } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnnouncements } from '../hooks/useAnnouncements';
import InactivityBanner from '../components/InactivityBanner';

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, gradient, loading,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5 relative overflow-hidden group">
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${gradient}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
          )}
          {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${gradient} bg-opacity-10`}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-brand font-bold">${Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders').select('*').eq('user_id', profile.id).eq('status', 'active');
      setInvestments(orders || []);
      const invested = orders?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
      setTotalInvested(invested);
      const total = orders?.reduce((sum, inv) => sum + (inv.amount * (1 + inv.daily_return / 100 * inv.duration_days)), 0) || 0;
      setTotalReturns(total - invested);

      const { data: staking } = await supabase
        .from('staking_orders').select('amount').eq('user_id', profile.id).eq('status', 'active');
      const stakingSum = staking?.reduce((s, o) => s + o.amount, 0) || 0;
      setStakingTotal(stakingSum);

      const { data: props } = await supabase
        .from('property_investments').select('amount_paid').eq('user_id', profile.id).eq('status', 'active');
      const propSum = props?.reduce((s, p) => s + p.amount_paid, 0) || 0;
      setPropertyTotal(propSum);

      const wallet = profile.wallet_balance || 0;
      setTotalPortfolio(wallet + invested + stakingSum + propSum);

      const { data: transactions } = await supabase
        .from('transactions').select('amount, created_at')
        .eq('user_id', profile.id).order('created_at', { ascending: true }).limit(30);

      if (transactions && transactions.length > 0) {
        const dayMap: { [key: string]: number } = {};
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          dayMap[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
        }
        transactions.forEach(t => {
          const date = new Date(t.created_at).toLocaleDateString('en-US', { weekday: 'short' });
          if (dayMap[date] !== undefined) dayMap[date] += t.amount;
        });
        const chartArray = Object.keys(dayMap).map(day => ({ day, value: 0 }));
        let cum = 0;
        chartArray.forEach((item, i) => { cum += dayMap[item.day] || 0; chartArray[i].value = cum; });
        setChartData(chartArray);
      } else {
        setChartData([
          { day: 'Mon', value: 0 }, { day: 'Tue', value: 200 }, { day: 'Wed', value: 450 },
          { day: 'Thu', value: 600 }, { day: 'Fri', value: 820 }, { day: 'Sat', value: 1050 }, { day: 'Sun', value: 1250 },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
    fetchData();
  }, [profile?.id]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <InactivityBanner />

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-sm text-amber-800">
          <span>Viewing as <strong>{profile.email}</strong></span>
          <button onClick={() => useAuthStore.getState().clearImpersonation()} className="underline font-medium">Stop</button>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wider">
            <Bell size={15} className="text-amber-500" /> Announcements
          </h2>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {announcements.map((a) => (
              <div key={a.id} className={`p-3 rounded-xl text-sm ${a.is_pinned ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                <p className="font-semibold text-gray-800">{a.title}</p>
                <p className="text-gray-600 text-xs mt-0.5">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, <span className="text-brand">{profile.name?.split(' ')[0] || 'Investor'}</span> 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's your financial overview today.</p>
        </div>
        <Link to="/app/invest" className="hidden sm:flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition">
          Invest Now <ArrowRight size={15} />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet size={20} className="text-emerald-600" />}
          label="Wallet Balance" value={fmt(profile.wallet_balance || 0)}
          gradient="bg-emerald-500" loading={loading}
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-blue-600" />}
          label="Total Invested" value={fmt(totalInvested)}
          gradient="bg-blue-500" loading={loading}
        />
        <StatCard
          icon={<DollarSign size={20} className="text-purple-600" />}
          label="Est. Returns" value={fmt(totalReturns)}
          gradient="bg-purple-500" loading={loading}
        />
        <StatCard
          icon={<PieChart size={20} className="text-indigo-600" />}
          label="Portfolio Value" value={fmt(totalPortfolio)}
          gradient="bg-indigo-500" loading={loading}
        />
      </div>

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Portfolio Performance</h2>
              <p className="text-xs text-gray-400 mt-0.5">7-day activity</p>
            </div>
            <span className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight size={12} /> Live
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.5} fill="url(#brandGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Portfolio Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Portfolio Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Wallet', value: profile.wallet_balance || 0, icon: <Wallet size={15} />, color: 'bg-emerald-500' },
              { label: 'Investments', value: totalInvested, icon: <TrendingUp size={15} />, color: 'bg-blue-500' },
              { label: 'Locked Savings', value: stakingTotal, icon: <Layers size={15} />, color: 'bg-indigo-500' },
              { label: 'Properties', value: propertyTotal, icon: <Home size={15} />, color: 'bg-amber-500' },
            ].map(({ label, value, color }) => {
              const pct = totalPortfolio > 0 ? (value / totalPortfolio) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className="text-sm font-semibold text-gray-900">{fmt(value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-gray-900 text-sm">Total</span>
              <span className="font-bold text-brand text-sm">{fmt(totalPortfolio)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Investments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active Investments</h2>
          <Link to="/app/portfolio" className="text-brand text-sm font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : investments.length === 0 ? (
          <div className="p-10 text-center">
            <TrendingUp size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No active investments.</p>
            <Link to="/app/invest" className="mt-3 inline-flex items-center gap-1.5 text-brand text-sm font-medium hover:underline">
              Start investing now <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Plan', 'Amount', 'Daily Return', 'Duration', 'Start', 'End', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {investments.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{inv.product_name}</td>
                    <td className="px-4 py-3.5 tabular-nums">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium">{inv.daily_return}%</td>
                    <td className="px-4 py-3.5 text-gray-600">{inv.duration_days}d</td>
                    <td className="px-4 py-3.5 text-gray-500">{new Date(inv.start_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-gray-500">{new Date(inv.end_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { to: '/app/invest',    label: 'Invest',        icon: <TrendingUp size={20} />, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { to: '/app/staking',   label: 'Lock Savings',  icon: <Layers    size={20} />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { to: '/app/wallet',    label: 'Wallet',        icon: <Wallet    size={20} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { to: '/app/referral',  label: 'Referrals',     icon: <DollarSign size={20} />, color: 'text-amber-600 bg-amber-50 border-amber-100' },
        ].map(({ to, label, icon, color }) => (
          <Link key={to} to={to} className={`flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${color}`}>
            <div className="shrink-0">{icon}</div>
            <span className="font-medium text-sm text-gray-800">{label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
