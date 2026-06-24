import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Users, AlertCircle } from 'lucide-react';
// remove Building

interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  down_payment_percent: number;
  monthly_payment: number;
  term_months: number;
  image_urls: string[];
  interested_count: number;
  status: string;
}

export default function Properties() {
  const { profile } = useAuthStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [myInvestments, setMyInvestments] = useState<any[]>([]);

  // Check restriction
  if (profile && !profile.can_property) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-600">Property Investments Disabled</h2>
        <p className="text-gray-600">{profile.restriction_reason || 'You are not allowed to invest in properties. Please contact support.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-2 text-sm">A deposit of ${profile.fee_required} is required to unlock property investments.</p>
        )}
        <Link to="/app" className="mt-4 inline-block text-brand hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  useEffect(() => {
    fetchProperties();
    fetchMyInvestments();
  }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('status', 'active');
    if (error) toast.error('Failed to load properties');
    else setProperties(data || []);
    setLoading(false);
  };

  const fetchMyInvestments = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('property_investments')
      .select('*, property:property_id(title)')
      .eq('user_id', profile.id);
    if (!error) setMyInvestments(data || []);
  };

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProperty) return;
    if (!profile.can_property) {
      toast.error('Property investments are disabled for your account');
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > profile.wallet_balance) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount: amount });
      const downPaymentRequired = selectedProperty.price * (selectedProperty.down_payment_percent / 100);
      const remaining = selectedProperty.price - (amount + downPaymentRequired);
      const { error } = await supabase.from('property_investments').insert({
        user_id: profile.id,
        property_id: selectedProperty.id,
        amount_paid: amount,
        remaining_balance: remaining,
        down_payment_paid: amount >= downPaymentRequired,
        status: amount >= downPaymentRequired ? 'active' : 'pending',
      });
      if (error) throw error;
      toast.success('Investment recorded!');
      await fetchMyInvestments();
      setModalOpen(false);
      setPaymentAmount('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">Property Investment</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-shadow">
            {p.image_urls?.[0] && <img src={p.image_urls[0]} alt={p.title} className="w-full h-48 object-cover" />}
            <div className="p-4">
              <h3 className="text-xl font-bold">{p.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{p.description}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Price</span><span className="font-semibold">{formatCurrency(p.price)}</span></div>
                <div className="flex justify-between"><span>Down Payment</span><span>{p.down_payment_percent}%</span></div>
                <div className="flex justify-between"><span>Monthly Payment</span><span>{formatCurrency(p.monthly_payment)}</span></div>
                <div className="flex justify-between"><span>Term</span><span>{p.term_months} months</span></div>
                <div className="flex items-center gap-1 text-xs text-gray-500"><Users size={14} /> {p.interested_count} interested</div>
              </div>
              <button
                onClick={() => { setSelectedProperty(p); setModalOpen(true); }}
                className="mt-4 w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-xl transition"
              >
                Invest Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Investment Modal */}
      {modalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-2">Invest in {selectedProperty.title}</h2>
            <p className="text-sm text-gray-600 mb-4">Price: {formatCurrency(selectedProperty.price)}</p>
            <form onSubmit={handleInvest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount to Pay (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand"
                  placeholder="Enter amount"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Down payment: {formatCurrency(selectedProperty.price * (selectedProperty.down_payment_percent/100))}</p>
              </div>
              <button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition">Pay Now</button>
              <button type="button" onClick={() => setModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 py-2 rounded-xl">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* My Investments */}
      <div className="bg-white rounded-2xl shadow-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">My Property Investments</h2>
        {myInvestments.length === 0 ? (
          <p className="text-gray-500">No property investments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-3 text-left">Property</th><th className="p-3 text-left">Paid</th><th className="p-3 text-left">Remaining</th><th className="p-3 text-left">Status</th></tr></thead>
              <tbody>
                {myInvestments.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3">{inv.property?.title || 'N/A'}</td>
                    <td className="p-3">{formatCurrency(inv.amount_paid)}</td>
                    <td className="p-3">{formatCurrency(inv.remaining_balance)}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${inv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span></td>
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