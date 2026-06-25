import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Users, AlertCircle, Building2, X, DollarSign, Calendar, Percent, CheckCircle } from 'lucide-react';

interface Property {
  id: string; title: string; description: string; price: number;
  down_payment_percent: number; monthly_payment: number; term_months: number;
  image_urls: string[]; interested_count: number; status: string;
}

export default function Properties() {
  const { profile } = useAuthStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [myInvestments, setMyInvestments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (profile && !profile.can_property) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Property Investments Disabled</h2>
        <p className="text-gray-500 text-sm mt-2">{profile.restriction_reason || 'Contact support to unlock property investments.'}</p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">A deposit of <strong>${profile.fee_required}</strong> is required to unlock.</p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-medium hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  useEffect(() => { fetchProperties(); fetchMyInvestments(); }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase.from('properties').select('*').eq('status', 'active');
    if (error) toast.error('Failed to load properties');
    else setProperties(data || []);
    setLoading(false);
  };

  const fetchMyInvestments = async () => {
    if (!profile) return;
    const { data, error } = await supabase.from('property_investments').select('*, property:property_id(title)').eq('user_id', profile.id);
    if (!error) setMyInvestments(data || []);
  };

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProperty) return;
    if (!profile.can_property) { toast.error('Property investments are disabled for your account'); return; }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > profile.wallet_balance) { toast.error('Insufficient balance'); return; }
    setSubmitting(true);
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount });
      const downPaymentRequired = selectedProperty.price * (selectedProperty.down_payment_percent / 100);
      const remaining = selectedProperty.price - (amount + downPaymentRequired);
      const { error } = await supabase.from('property_investments').insert({
        user_id: profile.id, property_id: selectedProperty.id,
        amount_paid: amount, remaining_balance: remaining,
        down_payment_paid: amount >= downPaymentRequired,
        status: amount >= downPaymentRequired ? 'active' : 'pending',
      });
      if (error) throw error;
      toast.success('Investment recorded!');
      await fetchMyInvestments();
      setModalOpen(false); setPaymentAmount('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-80" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Investment</h1>
        <p className="text-gray-500 text-sm mt-0.5">Invest in real estate with flexible payment terms.</p>
      </div>

      {/* Properties Grid */}
      {properties.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No properties available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(p => (
            <div key={p.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
              {/* Image */}
              {p.image_urls?.[0] ? (
                <div className="relative h-48 overflow-hidden">
                  <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 px-2.5 py-1 rounded-full">
                    <Users size={11} /> {p.interested_count} interested
                  </div>
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Building2 size={48} className="text-gray-300" />
                </div>
              )}

              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand transition-colors">{p.title}</h3>
                <p className="text-gray-500 text-sm mt-1 mb-4 line-clamp-2">{p.description}</p>

                <div className="space-y-2 text-sm flex-1">
                  {[
                    { icon: <DollarSign size={14} />, label: 'Price',           value: fmt(p.price) },
                    { icon: <Percent    size={14} />, label: 'Down Payment',    value: `${p.down_payment_percent}% (${fmt(p.price * p.down_payment_percent / 100)})` },
                    { icon: <Calendar  size={14} />, label: 'Monthly Payment', value: fmt(p.monthly_payment) },
                    { icon: <Calendar  size={14} />, label: 'Term',            value: `${p.term_months} months` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400 flex items-center gap-1.5">{icon}{label}</span>
                      <span className="font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setSelectedProperty(p); setModalOpen(true); }}
                  className="mt-5 w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <Building2 size={16} /> Invest Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Investment Modal */}
      {modalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invest in Property</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedProperty.title}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-400 text-xs">Full Price</p><p className="font-bold text-gray-900">{fmt(selectedProperty.price)}</p></div>
                <div><p className="text-gray-400 text-xs">Down Payment</p><p className="font-bold text-gray-900">{fmt(selectedProperty.price * selectedProperty.down_payment_percent / 100)}</p></div>
                <div><p className="text-gray-400 text-xs">Your Balance</p><p className="font-bold text-emerald-600">{fmt(profile?.wallet_balance || 0)}</p></div>
                <div><p className="text-gray-400 text-xs">Monthly</p><p className="font-bold text-gray-900">{fmt(selectedProperty.monthly_payment)}</p></div>
              </div>
              <form onSubmit={handleInvest} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount to Pay (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number" step="0.01" min="1"
                      value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder="Enter amount" required
                    />
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting ? 'Processing...' : 'Pay Now'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm transition">Cancel</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* My Investments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Property Investments</h2>
        </div>
        {myInvestments.length === 0 ? (
          <p className="p-8 text-gray-400 text-sm text-center">No property investments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Property', 'Amount Paid', 'Remaining', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myInvestments.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{inv.property?.title || 'N/A'}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium tabular-nums">{fmt(inv.amount_paid)}</td>
                    <td className="px-4 py-3.5 tabular-nums">{fmt(inv.remaining_balance)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${inv.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {inv.status === 'active' && <CheckCircle size={11} />}
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
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
