import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import {
  Wallet, AlertCircle, Calculator, ArrowRight, ChevronDown, ChevronUp,
  TrendingUp, Clock, Shield, Zap,
} from 'lucide-react';
import InvestmentModal from '../components/InvestmentModal';
import { useDepositAddress } from '../hooks/useDepositAddress';

interface Plan {
  id: string; name: string; description: string;
  min_invest: number; max_invest: number;
  daily_return: number; duration_days: number; status: string;
}

const PLAN_ACCENT = ['from-blue-500 to-indigo-600', 'from-brand to-emerald-600', 'from-purple-500 to-pink-500', 'from-amber-400 to-orange-500'];

export default function Invest() {
  const { user, profile, refreshProfile } = useAuthStore();
  const { investRestricted } = useAccountRestriction();
  const navigate = useNavigate();
  const { address, network, currency } = useDepositAddress();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [calculatorAmount, setCalculatorAmount] = useState<number>(100);
  const [selectedCalcPlan, setSelectedCalcPlan] = useState<Plan | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [walletWarning, setWalletWarning] = useState(false);

  const fetchPlans = async () => {
    const { data, error } = await supabase.from('products').select('*').eq('status', 'active');
    if (error) { toast.error('Failed to load plans'); }
    else {
      setPlans(data || []);
      if (data?.length) setSelectedCalcPlan(data[0]);
    }
    setLoading(false);
  };

  const checkWalletBalance = () => {
    if (!profile) return;
    setWalletWarning(profile.wallet_balance < 100);
  };

  useEffect(() => { fetchPlans(); checkWalletBalance(); }, []);

  const uniquePlans = useMemo(() => {
    const seen = new Set();
    return plans.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  }, [plans]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const calcResult = useMemo(() => {
    if (!selectedCalcPlan || !calculatorAmount) return null;
    const daily = selectedCalcPlan.daily_return / 100;
    const days = selectedCalcPlan.duration_days;
    const totalReturn = calculatorAmount * (1 + daily * days);
    const profit = totalReturn - calculatorAmount;
    return { totalReturn, profit, dailyProfit: calculatorAmount * daily };
  }, [selectedCalcPlan, calculatorAmount]);

  if (profile && (!profile.can_invest || investRestricted)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Investing Suspended</h2>
        <p className="text-gray-500 text-sm mt-2">
          {investRestricted
            ? 'Investment features are suspended due to account inactivity. Please top up your wallet to restore access.'
            : (profile.restriction_reason || 'Contact support to unlock investing.')
          }
        </p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
            A deposit of <strong>${profile.fee_required}</strong> is required to unlock.
          </p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-medium hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const handleInvest = (plan: Plan) => {
    if (!user) { toast.error('Please login to invest'); navigate('/login'); return; }
    if (profile && (!profile.can_invest || investRestricted)) { toast.error('Investing is disabled for your account'); return; }
    setSelectedPlan(plan);
  };

  const handleInvestmentSuccess = () => {
    toast.success('Investment created!');
    refreshProfile(); fetchPlans(); checkWalletBalance();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investment Plans</h1>
          <p className="text-gray-500 text-sm mt-0.5">Choose a plan that fits your goals and start earning daily.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {walletWarning && (
            <div className="flex items-center gap-2 text-xs bg-red-50 px-4 py-2 rounded-full border border-red-200 text-red-700 animate-pulse">
              <AlertCircle size={14} /> Balance below $100 — top up to keep account active
            </div>
          )}
          <div className="flex items-center gap-2 text-sm bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
            <Wallet size={16} className="text-emerald-600" />
            <span className="text-emerald-800">Balance: <strong>{fmt(profile?.wallet_balance || 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* Benefits strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: <TrendingUp size={18} className="text-blue-600" />, label: 'Daily Payouts', sub: 'Every 24 hours' },
          { icon: <Shield     size={18} className="text-emerald-600" />, label: 'Principal Safe', sub: 'Capital protected' },
          { icon: <Zap        size={18} className="text-amber-600"  />, label: 'Instant Start',  sub: 'Earn from day 1' },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="flex items-center justify-between w-full px-6 py-4 hover:bg-gray-50/50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl"><Calculator size={18} className="text-brand" /></div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Return Calculator</p>
              <p className="text-xs text-gray-400">Estimate your profits before investing</p>
            </div>
          </div>
          {showCalc ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {showCalc && (
          <div className="border-t border-gray-100 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Plan</label>
                <select
                  value={selectedCalcPlan?.id || ''}
                  onChange={e => setSelectedCalcPlan(uniquePlans.find(p => p.id === e.target.value) || null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  {uniquePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Investment Amount ($)</label>
                <input
                  type="number"
                  min={selectedCalcPlan?.min_invest || 10}
                  max={selectedCalcPlan?.max_invest || 100000}
                  value={calculatorAmount}
                  onChange={e => setCalculatorAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Min: ${selectedCalcPlan?.min_invest?.toLocaleString()} – Max: ${selectedCalcPlan?.max_invest?.toLocaleString()}
                </p>
              </div>
            </div>
            {calcResult && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-white space-y-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Projected Return</p>
                <p className="text-4xl font-extrabold tabular-nums tracking-tight text-emerald-400">{fmt(calcResult.totalReturn)}</p>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Profit</p>
                    <p className="font-bold text-emerald-400">{fmt(calcResult.profit)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Daily Earnings</p>
                    <p className="font-bold text-white">{fmt(calcResult.dailyProfit)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Duration</p>
                    <p className="font-bold text-white flex items-center gap-1"><Clock size={12} /> {selectedCalcPlan?.duration_days} days</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Daily Rate</p>
                    <p className="font-bold text-white">{selectedCalcPlan?.daily_return}%</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 pt-1">* Projections only. Actual returns vary by market conditions.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plans Grid */}
      {uniquePlans.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <TrendingUp size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No active plans available right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uniquePlans.map((plan, index) => {
            const accent = PLAN_ACCENT[index % PLAN_ACCENT.length];
            const totalReturn = plan.min_invest * (1 + plan.daily_return / 100 * plan.duration_days);
            return (
              <div
                key={plan.id}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Top accent bar */}
                <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand transition-colors">{plan.name}</h3>
                    <span className="text-2xl font-extrabold bg-gradient-to-r from-brand to-emerald-600 bg-clip-text text-transparent tabular-nums">
                      {plan.daily_return}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">daily return</p>
                  <p className="text-gray-500 text-sm mt-1 mb-4">{plan.description}</p>

                  <div className="space-y-2 text-sm flex-1">
                    {[
                      { label: 'Min Investment', value: fmt(plan.min_invest) },
                      { label: 'Max Investment', value: fmt(plan.max_invest) },
                      { label: 'Duration',        value: `${plan.duration_days} days` },
                      { label: 'Est. Total (min)',  value: fmt(totalReturn), highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-500">{label}</span>
                        <span className={`font-semibold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" id={`compound-${plan.id}`} className="w-4 h-4 accent-brand" />
                    <label htmlFor={`compound-${plan.id}`} className="text-xs text-gray-500">Auto-reinvest daily returns</label>
                  </div>

                  <button
                    onClick={() => handleInvest(plan)}
                    className={`mt-5 w-full bg-gradient-to-r ${accent} hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg`}
                  >
                    Invest Now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPlan && (
        <InvestmentModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={handleInvestmentSuccess}
          depositAddress={address}
          depositNetwork={network}
          depositCurrency={currency}
        />
      )}
    </div>
  );
}
