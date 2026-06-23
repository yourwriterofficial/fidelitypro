import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TrendingUp, Clock, Wallet, AlertCircle, Calculator, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import InvestmentModal from '../components/InvestmentModal';
import { useDepositAddress } from '../hooks/useDepositAddress';

interface Plan {
  id: string;
  name: string;
  description: string;
  min_invest: number;
  max_invest: number;
  daily_return: number;
  duration_days: number;
  status: string;
}

export default function Invest() {
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const { address, network, currency } = useDepositAddress();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calculatorAmount, setCalculatorAmount] = useState<number>(100);
  const [selectedCalcPlan, setSelectedCalcPlan] = useState<Plan | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [walletWarning, setWalletWarning] = useState(false);

  // Check restriction
  if (profile && !profile.can_invest) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-600">Investing Disabled</h2>
        <p className="text-gray-600">{profile.restriction_reason || 'You are not allowed to invest. Please contact support.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-2 text-sm">A deposit of ${profile.fee_required} is required to unlock investing.</p>
        )}
        <Link to="/app" className="mt-4 inline-block text-brand hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  // Deduplicate plans
  const uniquePlans = useMemo(() => {
    const seen = new Set();
    return plans.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [plans]);

  useEffect(() => {
    fetchPlans();
    checkWalletBalance();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active');
    if (error) {
      console.error(error);
      toast.error('Failed to load plans');
    } else {
      setPlans(data || []);
      if (data && data.length > 0) {
        setSelectedCalcPlan(data[0]);
      }
    }
    setLoading(false);
  };

  const checkWalletBalance = () => {
    if (!profile) return;
    setWalletWarning(profile.wallet_balance < 100);
  };

  const handleInvest = (plan: Plan) => {
    if (!user) {
      toast.error('Please login to invest');
      navigate('/login');
      return;
    }
    if (profile && !profile.can_invest) {
      toast.error('Investing is disabled for your account');
      return;
    }
    setSelectedPlan(plan);
    setModalOpen(true);
  };

  const handleInvestmentSuccess = () => {
    toast.success('Investment created!');
    refreshProfile();
    fetchPlans();
    checkWalletBalance();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const calcResult = useMemo(() => {
    if (!selectedCalcPlan || !calculatorAmount) return null;
    const amount = calculatorAmount;
    const daily = selectedCalcPlan.daily_return / 100;
    const days = selectedCalcPlan.duration_days;
    const totalReturn = amount * (1 + daily * days);
    const profit = totalReturn - amount;
    return { totalReturn, profit, dailyProfit: amount * daily };
  }, [selectedCalcPlan, calculatorAmount]);

  if (loading) return <div className="p-8 text-center">Loading investment plans...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">Investment Plans</h1>
          <p className="text-gray-600">Choose a plan that fits your goals</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {walletWarning && (
            <div className="flex items-center gap-2 text-sm bg-red-50 px-4 py-2 rounded-full border border-red-200 text-red-700 animate-pulse">
              <AlertCircle size={18} />
              <span>Balance below $100 – top up to keep account active</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm bg-green-50 px-4 py-2 rounded-full border border-green-200">
            <Wallet size={18} className="text-green-600" />
            <span>Wallet: <strong>{formatCurrency(profile?.wallet_balance || 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8 hover:shadow-xl transition-shadow duration-300">
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-brand" />
            <h2 className="text-xl font-semibold">Calculate Your Returns</h2>
          </div>
          {showCalc ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showCalc && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Plan</label>
                <select
                  value={selectedCalcPlan?.id || ''}
                  onChange={(e) => {
                    const plan = uniquePlans.find(p => p.id === e.target.value);
                    setSelectedCalcPlan(plan || null);
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                >
                  {uniquePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Investment Amount ($)</label>
                <input
                  type="number"
                  min={selectedCalcPlan?.min_invest || 10}
                  max={selectedCalcPlan?.max_invest || 10000}
                  value={calculatorAmount}
                  onChange={(e) => setCalculatorAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Min: ${selectedCalcPlan?.min_invest} – Max: ${selectedCalcPlan?.max_invest}
                </div>
              </div>
            </div>
            {calcResult && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-2 border border-gray-200">
                <p className="text-sm text-gray-500">Projected Return</p>
                <p className="text-3xl font-bold text-brand">{formatCurrency(calcResult.totalReturn)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Profit</span>
                    <p className="font-semibold text-green-600">{formatCurrency(calcResult.profit)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Daily Return</span>
                    <p className="font-semibold">{formatCurrency(calcResult.dailyProfit)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  * Estimates. Actual yields depend on market conditions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {uniquePlans.map((plan, index) => (
          <div
            key={plan.id}
            className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-brand/30"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand transition-colors">{plan.name}</h3>
            </div>
            <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
            <div className="space-y-2 text-sm flex-1 mt-4">
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-500">Min Investment</span>
                <span className="font-medium">{formatCurrency(plan.min_invest)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-500">Max Investment</span>
                <span className="font-medium">{formatCurrency(plan.max_invest)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-500">Daily Return</span>
                <span className="font-medium text-green-600">{plan.daily_return}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{plan.duration_days} days</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id={`compound-${plan.id}`} className="w-4 h-4 text-brand" />
              <label htmlFor={`compound-${plan.id}`} className="text-xs text-gray-600">Auto-reinvest daily returns</label>
            </div>
            <div className="mt-6">
              <button
                onClick={() => handleInvest(plan)}
                className="w-full bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand text-white font-semibold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                Invest Now <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {uniquePlans.length === 0 && (
        <div className="text-center py-12 text-gray-500">No active plans available right now.</div>
      )}

      {/* Investment Modal */}
      {selectedPlan && (
        <InvestmentModal
          plan={selectedPlan}
          onClose={() => setModalOpen(false)}
          onSuccess={handleInvestmentSuccess}
          depositAddress={address}
          depositNetwork={network}
          depositCurrency={currency}
        />
      )}
    </div>
  );
}