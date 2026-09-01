import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import {
  AlertCircle, Calculator, ArrowRight, ChevronUp,
  TrendingUp, Clock, Shield, Home, Layers, ArrowLeftRight
} from 'lucide-react';
import InvestmentModal from '../components/InvestmentModal';
import { useDepositAddress } from '../hooks/useDepositAddress';

interface Plan {
  id: string; name: string; description: string;
  min_invest: number; max_invest: number;
  daily_return: number; duration_days: number; status: string;
}

export default function Invest() {
  const { user, profile, refreshProfile } = useAuthStore();
  const { investRestricted } = useAccountRestriction();
  const navigate = useNavigate();
  const { address, network, currency } = useDepositAddress();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [calculatorAmount, setCalculatorAmount] = useState<number>(1000);
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
    toast.success('Investment plan initiated successfully!');
    refreshProfile(); fetchPlans(); checkWalletBalance();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-3xl h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Yield Portfolios
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Managed Investment Plans
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Select capital allocation tiers with daily compounding interest and capital preservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {walletWarning && (
            <div className="flex items-center gap-2 text-xs bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 text-amber-800">
              <AlertCircle size={14} className="shrink-0" /> Low balance warning
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Available Wallet</span>
            <span className="text-base font-extrabold text-brand tabular-nums">{fmt(profile?.wallet_balance || 0)}</span>
          </div>
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-brand text-white font-bold text-xs px-4 py-3 rounded-2xl transition shadow-sm"
          >
            <Calculator size={15} /> Return Calculator
          </button>
        </div>
      </div>

      {/* Benefits Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-brand/10 text-brand rounded-xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Daily Payout Settlement</p>
            <p className="text-[11px] text-gray-400">Credited automatically every 24 hours</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Capital Preservation</p>
            <p className="text-[11px] text-gray-400">Principal returned at term maturity</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Immediate Activation</p>
            <p className="text-[11px] text-gray-400">Yield generation starts on first settlement</p>
          </div>
        </div>
      </div>

      {/* Return Calculator */}
      {showCalc && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md p-6 sm:p-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand/10 text-brand rounded-xl">
                <Calculator size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Plan Yield Calculator</h2>
            </div>
            <button onClick={() => setShowCalc(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <ChevronUp size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Select Tier</label>
                <select
                  value={selectedCalcPlan?.id || ''}
                  onChange={e => setSelectedCalcPlan(uniquePlans.find(p => p.id === e.target.value) || null)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                >
                  {uniquePlans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.daily_return}% / day ({p.duration_days} Days)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Investment Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    min={selectedCalcPlan?.min_invest || 10}
                    max={selectedCalcPlan?.max_invest || 100000}
                    value={calculatorAmount}
                    onChange={e => setCalculatorAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-bold"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Tier Limits: ${selectedCalcPlan?.min_invest?.toLocaleString()} min — ${selectedCalcPlan?.max_invest?.toLocaleString()} max
                </p>
              </div>
            </div>

            {calcResult && (
              <div className="bg-gray-900 text-white rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Total Payout at Completion</span>
                  <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tabular-nums mt-1">{fmt(calcResult.totalReturn)}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-800 text-xs">
                    <div>
                      <span className="text-gray-400 block">Total Profit</span>
                      <span className="font-bold text-emerald-400 text-sm">+{fmt(calcResult.profit)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Daily Yield</span>
                      <span className="font-bold text-white text-sm">+{fmt(calcResult.dailyProfit)}/day</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Duration</span>
                      <span className="font-bold text-white">{selectedCalcPlan?.duration_days} Days</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Daily Rate</span>
                      <span className="font-bold text-brand-light">{selectedCalcPlan?.daily_return}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-4">
                  * Daily returns settle automatically into your primary wallet balance.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {uniquePlans.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-200/80">
          <TrendingUp size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-bold text-sm">No investment plans currently active.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uniquePlans.map((plan) => {
            const totalReturn = plan.min_invest * (1 + plan.daily_return / 100 * plan.duration_days);
            return (
              <div
                key={plan.id}
                className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-xl hover:border-brand/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full">
                      {plan.duration_days} Days Plan
                    </span>
                    <span className="text-xs font-medium text-gray-400">Fixed Daily</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mt-2">{plan.name}</h3>
                  <div className="my-3">
                    <span className="text-3xl font-extrabold text-brand tracking-tight">{plan.daily_return}%</span>
                    <span className="text-xs text-gray-500 ml-1 font-semibold">/ day</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{plan.description}</p>

                  <div className="space-y-2 text-xs border-t border-gray-100 pt-3">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Minimum Capital</span>
                      <span className="font-bold text-gray-900">${plan.min_invest.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Maximum Limit</span>
                      <span className="font-bold text-gray-900">${plan.max_invest ? plan.max_invest.toLocaleString() : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Min Total Payout</span>
                      <span className="font-bold text-emerald-700">{fmt(totalReturn)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleInvest(plan)}
                  className="mt-6 w-full bg-gray-900 group-hover:bg-brand text-white font-bold py-3.5 rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  Initiate Plan <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cross-Product Discovery Strip */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">Explore Diversified Portfolios</h2>
          <p className="text-xs text-gray-500">Discover other asset pillars across the ecosystem</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/app/properties"
            className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 hover:shadow-md transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-sm shrink-0">
              <Home size={16} />
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900 group-hover:text-amber-700 transition-colors block">
                Real Estate Properties
              </span>
              <span className="text-xs text-gray-500 block mt-0.5">
                Fractional deeds from $500 with rental yields
              </span>
            </div>
          </Link>

          <Link
            to="/app/staking"
            className="flex items-start gap-3.5 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 hover:shadow-md transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900 group-hover:text-indigo-700 transition-colors block">
                Locked Savings (Staking)
              </span>
              <span className="text-xs text-gray-500 block mt-0.5">
                Earn fixed APY with 100% principal guarantee
              </span>
            </div>
          </Link>

          <Link
            to="/app/p2p"
            className="flex items-start gap-3.5 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 hover:shadow-md transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-sm shrink-0">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900 group-hover:text-teal-700 transition-colors block">
                P2P Escrow Market
              </span>
              <span className="text-xs text-gray-500 block mt-0.5">
                0% fee multi-currency OTC exchange
              </span>
            </div>
          </Link>
        </div>
      </div>

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
