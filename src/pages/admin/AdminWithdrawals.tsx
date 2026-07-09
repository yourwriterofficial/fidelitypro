import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  address: string;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string };
}

export default function AdminWithdrawals() {
  const { user } = useAuthStore();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchWithdrawals = async () => {
    setLoading(true);
    let query = supabase
      .from('withdrawals')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error('Failed to load withdrawals');
    } else {
      setWithdrawals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);


  const logAdminAction = async (action: string, details: string, targetId: string) => {
    if (!user) return;
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: action,
      target_table: 'withdrawals',
      target_id: targetId,
      details: { details },
    });
  };

  const [processingId, setProcessingId] = useState<string | null>(null);

  const updateWithdrawalStatus = async (withdrawalId: string, newStatus: string) => {
    if (processingId) return;
    setProcessingId(withdrawalId);
    try {
      // Concurrency check: only update if status is 'pending'
      const { data, error } = await supabase
        .from('withdrawals')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', withdrawalId)
        .eq('status', 'pending')
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('This withdrawal request has already been processed.');
        fetchWithdrawals();
        return;
      }

      const withdrawal = withdrawals.find(w => w.id === withdrawalId);

      if (newStatus === 'approved' && withdrawal) {
        await supabase.rpc('deduct_wallet_balance', {
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
        });
        await supabase.from('transactions').insert({
          user_id: withdrawal.user_id,
          type: 'withdrawal',
          amount: -withdrawal.amount,
          description: 'Withdrawal approved',
          status: 'completed',
        });
      }

      await logAdminAction(
        `withdrawal_${newStatus}`,
        `Withdrawal ${newStatus} for ${withdrawal?.profiles?.name || withdrawal?.user_id} of $${withdrawal?.amount}`,
        withdrawalId
      );

      toast.success(`Withdrawal ${newStatus}`);
      fetchWithdrawals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading withdrawals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Withdrawals</h1>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-brand text-white' : 'bg-gray-100'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Amount</th>
                <th className="text-left p-4">Address</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="p-4">{w.profiles?.name || 'N/A'}</td>
                  <td className="p-4">{w.profiles?.email || 'N/A'}</td>
                  <td className="p-4">{formatCurrency(w.amount)}</td>
                  <td className="p-4 max-w-xs truncate">{w.address}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      w.status === 'approved' ? 'bg-green-100 text-green-700' :
                      w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      w.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="p-4">{new Date(w.created_at).toLocaleDateString()}</td>
                  <td className="p-4 space-x-2">
                    {w.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateWithdrawalStatus(w.id, 'approved')}
                          className="text-green-600 hover:text-green-800 disabled:opacity-40"
                          disabled={processingId === w.id}
                        >
                          <CheckCircle size={20} />
                        </button>
                        <button
                          onClick={() => updateWithdrawalStatus(w.id, 'rejected')}
                          className="text-red-600 hover:text-red-800 disabled:opacity-40"
                          disabled={processingId === w.id}
                        >
                          <XCircle size={20} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {withdrawals.length === 0 && <p className="p-8 text-gray-500 text-center">No withdrawals found.</p>}
      </div>
    </div>
  );
}