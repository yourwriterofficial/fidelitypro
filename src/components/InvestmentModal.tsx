import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { X, Copy, Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  min_invest: number;
  max_invest: number;
  daily_return: number;
  duration_days: number;
  description?: string;
}

interface InvestmentModalProps {
  plan: Plan | null;
  onClose: () => void;
  onSuccess: () => void;
  depositAddress: string | null;
  depositNetwork: string;
  depositCurrency: string;
}

export default function InvestmentModal({
  plan,
  onClose,
  onSuccess,
  depositAddress,
  depositNetwork,
  depositCurrency,
}: InvestmentModalProps) {
  const { user, profile, refreshProfile } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'deposit'>('form');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [walletUsed, setWalletUsed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      toast.error('Please login first');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!plan) return;
    if (numAmount < plan.min_invest) {
      toast.error(`Minimum investment is $${plan.min_invest}`);
      return;
    }
    if (numAmount > plan.max_invest) {
      toast.error(`Maximum investment is $${plan.max_invest}`);
      return;
    }
    setLoading(true);
    try {
      // Determine if wallet has enough balance
      let orderStatus = 'pending';
      let useWallet = false;
      if (profile.wallet_balance >= numAmount) {
        useWallet = true;
        orderStatus = 'active';
        // Deduct wallet
        const { error: deductError } = await supabase
          .from('profiles')
          .update({ wallet_balance: profile.wallet_balance - numAmount })
          .eq('id', profile.id);
        if (deductError) throw deductError;
        // Record transaction
        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'investment',
          amount: -numAmount,
          description: `Investment in ${plan.name}`,
          status: 'completed',
        });
        await refreshProfile();
        toast.success(`$${numAmount} deducted from wallet. Investment activated!`);
        setWalletUsed(true);
      } else {
        setWalletUsed(false);
      }

      // Create order
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          product_id: plan.id,
          product_name: plan.name,
          amount: numAmount,
          daily_return: plan.daily_return,
          duration_days: plan.duration_days,
          status: orderStatus,
          start_date: startDate,
          end_date: endDate,
        })
        .select()
        .single();
      if (error) throw error;
      setOrderId(data.id);

      if (useWallet) {
        // Already active, close modal and refresh
        toast.success('Investment active!');
        onSuccess();
        onClose(); // ✅ Close modal after success
      } else {
        // Show deposit instructions
        setStep('deposit');
        toast.success('Investment order created! Please deposit to activate.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create investment');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied!');
  };

  if (!plan) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {/* ✅ Close button now calls onClose */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>

        {step === 'form' ? (
          <>
            <h2 className="text-2xl font-bold mb-2">Invest in {plan.name}</h2>
            <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
            <div className="bg-gray-50 p-4 rounded-xl mb-4 space-y-2 text-sm">
              <div><span className="font-medium">Daily Return:</span> {plan.daily_return}%</div>
              <div><span className="font-medium">Duration:</span> {plan.duration_days} days</div>
              <div><span className="font-medium">Min:</span> ${plan.min_invest} &nbsp;|&nbsp; <span className="font-medium">Max:</span> ${plan.max_invest}</div>
              <div><span className="font-medium">Wallet Balance:</span> ${profile?.wallet_balance?.toFixed(2)}</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min={plan.min_invest}
                  max={plan.max_invest}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand"
                  placeholder={`Enter amount ($${plan.min_invest} - $${plan.max_invest})`}
                  required
                />
                {profile && profile.wallet_balance < plan.min_invest && (
                  <p className="text-xs text-red-500 mt-1">Insufficient balance for minimum investment. Please top up.</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-70"
              >
                {loading ? 'Processing...' : 'Invest Now'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-2">Deposit Instructions</h2>
            <p className="text-gray-600 text-sm mb-4">
              Your investment order has been created. Please send the exact amount to the address below to activate.
            </p>
            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Amount:</span>
                <span className="font-bold">${amount}</span>
              </div>
              <div>
                <span className="font-medium">Address:</span>
                <div className="flex items-center justify-between bg-white p-2 rounded border mt-1">
                  <code className="text-sm break-all">{depositAddress || 'Loading...'}</code>
                  <button onClick={copyAddress} className="ml-2 p-1 hover:bg-gray-200 rounded">
                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Network: {depositNetwork}<br />
                Currency: {depositCurrency}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                After sending, your investment will be activated within 24 hours upon confirmation.
              </p>
            </div>
            <button
              onClick={() => {
                onSuccess();
                onClose(); // ✅ Close after user says they sent
              }}
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-xl transition"
            >
              I've Sent, Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}