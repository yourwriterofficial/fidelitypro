import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import {
  Wallet, TrendingUp, Bell, PieChart, ArrowRight, ArrowUpRight,
  Layers, Home, ArrowLeftRight, Building, Lock, CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnnouncements } from '../hooks/useAnnouncements';
import InactivityBanner from '../components/InactivityBanner';

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, badge, loading, linkTo,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  badge?: string; loading?: boolean; linkTo?: string;
}) {
  const content = (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition-all p-5 h-full flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
          <div className="p-2 rounded-xl bg-gray-50 text-gray-700 border border-gray-100 group-hover:border-gray-200 transition-colors">
            {icon}
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28 my-1" />
        ) : (
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-xs">
          <span className="text-gray-400 truncate">{sub}</span>
          {badge && (
            <span className="font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-md text-[11px] shrink-0">
              {badge}
            </span>
          )}
        </div>
      </div>
      {linkTo && (
        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-brand group-hover:text-brand-dark transition-colors">
          <span>Manage Asset</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );

  return linkTo ? <Link to={linkTo} className="block h-full">{content}</Link> : content;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white border border-gray-800 shadow-xl rounded-xl p-3 text-xs">
      <p className="font-medium text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-emerald-400">${Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, refreshProfile, isImpersonating } = useAuthStore();
  const { data: announcements = [] } = useAnnouncements();
  const [investments, setInvestments] = useState<any[]>([]);
  const [stakingOrders, setStakingOrders] = useState<any[]>([]);
  const [propertyInvestments, setPropertyInvestments] = useState<any[]>([]);
  const [p2pCount, setP2pCount] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [stakingTotal, setStakingTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'properties' | 'staking' | 'investments'>('all');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Orders / Investments
      const { data: orders } = await supabase
        .from('orders').select('*').eq('user_id', profile.id).eq('status', 'active');
      setInvestments(orders || []);
      const invested = orders?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
      setTotalInvested(invested);

      // 2. Staking
      const { data: staking } = await supabase
        .from('staking_orders').select('*').eq('user_id', profile.id).eq('status', 'active');
      setStakingOrders(staking || []);
      const stakingSum = staking?.reduce((s, o) => s + o.amount, 0) || 0;
      setStakingTotal(stakingSum);

      // 3. Properties
      const { data: props } = await supabase
        .from('property_investments').select('*, property:property_id(*)').eq('user_id', profile.id).eq('status', 'active');
      setPropertyInvestments(props || []);
      const propSum = props?.reduce((s, p) => s + p.amount_paid, 0) || 0;
      setPropertyTotal(propSum);

      // 4. P2P Trades count
      try {
        const { count } = await supabase
          .from('p2p_orders').select('*', { count: 'exact', head: true })
          .or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`);
        setP2pCount(count || 0);
      } catch {
        setP2pCount(0);
      }

      // Net Asset Value
      const wallet = profile.wallet_balance || 0;
      setTotalPortfolio(wallet + invested + stakingSum + propSum);

      // Chart transactions
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
    <div className="space-y-6 pb-12">
      <InactivityBanner />

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-900 font-medium">
          <span>Viewing as <strong>{profile.email}</strong></span>
          <button onClick={() => useAuthStore.getState().clearImpersonation()} className="underline font-bold">Stop</button>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 space-y-2">
          <h2 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
            <Bell size={14} className="text-amber-500" /> Platform Notices
          </h2>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {announcements.map((a) => (
              <div key={a.id} className={`p-3 rounded-xl text-xs ${a.is_pinned ? 'bg-amber-50/70 border border-amber-200/70' : 'bg-gray-50 border border-gray-100'}`}>
                <p className="font-bold text-gray-900">{a.title}</p>
                <p className="text-gray-600 mt-0.5 leading-relaxed">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Institutional Portfolio Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Portfolio Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage real estate equity, locked savings, P2P liquidity, and daily ROI allocations.
          </p>
        </div>

        {/* 4 Action Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Link
            to="/app/properties"
            className="flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition"
          >
            <Home size={14} /> Properties
          </Link>
          <Link
            to="/app/staking"
            className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition"
          >
            <Layers size={14} /> Staking
          </Link>
          <Link
            to="/app/p2p"
            className="flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100/80 text-teal-800 border border-teal-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition"
          >
            <ArrowLeftRight size={14} /> P2P Desk
          </Link>
          <Link
            to="/app/invest"
            className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition shadow-sm"
          >
            <TrendingUp size={14} /> ROI Plans
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<PieChart size={18} className="text-gray-700" />}
          label="Total Portfolio NAV"
          value={fmt(totalPortfolio)}
          sub="Combined balance"
          badge="Net Total"
          loading={loading}
          linkTo="/app/my-portfolio"
        />
        <StatCard
          icon={<Home size={18} className="text-amber-700" />}
          label="Real Estate Properties"
          value={fmt(propertyTotal)}
          sub={`${propertyInvestments.length} fractional deeds`}
          badge="9–14% Yield"
          loading={loading}
          linkTo="/app/properties"
        />
        <StatCard
          icon={<Layers size={18} className="text-indigo-700" />}
          label="Locked Savings (Staking)"
          value={fmt(stakingTotal)}
          sub={`${stakingOrders.length} active locks`}
          badge="Up to 18% APY"
          loading={loading}
          linkTo="/app/staking"
        />
        <StatCard
          icon={<Wallet size={18} className="text-teal-700" />}
          label="Liquid Wallet Balance"
          value={fmt(profile.wallet_balance || 0)}
          sub={`${p2pCount} P2P orders available`}
          badge="Instant"
          loading={loading}
          linkTo="/app/wallet"
        />
      </div>

      {/* Featured Portals (Properties, Staking, P2P) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Real Estate Property */}
        <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
                <Building size={20} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                Fractional Ownership
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900">Real Estate Property Portfolio</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Invest in legally deeded commercial & residential assets from $500. Receive monthly rental yield distributions.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Target Annual Yield</span>
              <span className="font-bold text-amber-700">9.0% – 14.5%</span>
            </div>
          </div>
          <Link
            to="/app/properties"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 rounded-xl transition"
          >
            Explore Real Estate <ArrowRight size={13} />
          </Link>
        </div>

        {/* Locked Staking */}
        <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                <Lock size={20} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200/60">
                Guaranteed Principal
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900">Locked Savings & Fixed APY</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Commit capital for fixed terms (7–365 days). Earn fixed daily compound yield with 100% principal return at maturity.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Lock Terms</span>
              <span className="font-bold text-indigo-700">7 to 365 Days</span>
            </div>
          </div>
          <Link
            to="/app/staking"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition"
          >
            Open Locked Savings <ArrowRight size={13} />
          </Link>
        </div>

        {/* P2P Escrow Exchange */}
        <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-teal-300 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl border border-teal-100">
                <ArrowLeftRight size={20} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/60">
                0% Exchange Fee
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900">P2P Escrow Marketplace</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Trade USDT and fiat currencies directly with verified investors worldwide at custom exchange rates.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Escrow Guarantee</span>
              <span className="font-bold text-teal-700">Automated Protection</span>
            </div>
          </div>
          <Link
            to="/app/p2p"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-3 rounded-xl transition"
          >
            Trade P2P Now <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Chart + Asset Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Portfolio Performance</h2>
              <p className="text-xs text-gray-400 mt-0.5">7-day transaction and asset trend</p>
            </div>
            <span className="text-xs font-semibold bg-gray-50 text-brand border border-gray-200 px-3 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight size={12} /> Live Settlement
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00674F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00674F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#00674F" strokeWidth={2.5} fill="url(#brandGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Asset Breakdown */}
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base mb-1">Asset Allocation</h2>
            <p className="text-xs text-gray-400 mb-5">Distribution across asset categories</p>
            <div className="space-y-3.5">
              {[
                { label: 'Real Estate Properties', value: propertyTotal, color: 'bg-amber-500' },
                { label: 'Locked Savings (Staking)', value: stakingTotal, color: 'bg-indigo-500' },
                { label: 'Investment ROI Plans', value: totalInvested, color: 'bg-brand' },
                { label: 'Liquid Wallet Balance', value: profile.wallet_balance || 0, color: 'bg-teal-500' },
              ].map(({ label, value, color }) => {
                const pct = totalPortfolio > 0 ? ((value / totalPortfolio) * 100).toFixed(1) : '0';
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${color}`} /> {label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{fmt(value)}</span>
                        <span className="text-[10px] text-gray-400 font-medium w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-900 text-sm">Total Assets</span>
            <span className="font-extrabold text-brand text-base">{fmt(totalPortfolio)}</span>
          </div>
        </div>
      </div>

      {/* Active Holdings Table */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Active Positions & Holdings</h2>
            <p className="text-xs text-gray-400">All live holdings across portfolio categories</p>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            {(['all', 'properties', 'staking', 'investments'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset / Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position Value</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Yield Rate</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Properties */}
                {(activeTab === 'all' || activeTab === 'properties') && propertyInvestments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 flex items-center gap-2">
                      <Home size={15} className="text-amber-600 shrink-0" />
                      <span>{p.property?.title || 'Real Estate Fractional Share'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
                        Property
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(p.amount_paid)}</td>
                    <td className="px-5 py-3.5 text-amber-700 font-medium">Rental Dividend</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-brand text-xs font-medium rounded-full">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to="/app/properties" className="text-xs font-semibold text-brand hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}

                {/* Staking */}
                {(activeTab === 'all' || activeTab === 'staking') && stakingOrders.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 flex items-center gap-2">
                      <Layers size={15} className="text-indigo-600 shrink-0" />
                      <span>{s.product_name || `Fixed Lock ${s.lock_days}d`}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
                        Locked Savings
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(s.amount)}</td>
                    <td className="px-5 py-3.5 text-indigo-700 font-bold">{s.apy}% APY</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-brand text-xs font-medium rounded-full">
                        <CheckCircle2 size={11} /> Locked
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to="/app/staking" className="text-xs font-semibold text-brand hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}

                {/* Investments */}
                {(activeTab === 'all' || activeTab === 'investments') && investments.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 flex items-center gap-2">
                      <TrendingUp size={15} className="text-brand shrink-0" />
                      <span>{inv.product_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
                        ROI Plan
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(inv.amount)}</td>
                    <td className="px-5 py-3.5 text-brand font-bold">{inv.daily_return}% / day</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-brand text-xs font-medium rounded-full">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to="/app/my-portfolio" className="text-xs font-semibold text-brand hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}

                {propertyInvestments.length === 0 && stakingOrders.length === 0 && investments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                      <p className="mb-2">No active positions currently active.</p>
                      <div className="flex justify-center gap-3 mt-3">
                        <Link to="/app/properties" className="text-xs font-semibold text-amber-700 hover:underline">
                          + Browse Real Estate
                        </Link>
                        <span className="text-gray-300">•</span>
                        <Link to="/app/staking" className="text-xs font-semibold text-indigo-700 hover:underline">
                          + Staking Locks
                        </Link>
                        <span className="text-gray-300">•</span>
                        <Link to="/app/p2p" className="text-xs font-semibold text-teal-700 hover:underline">
                          + P2P Market
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
