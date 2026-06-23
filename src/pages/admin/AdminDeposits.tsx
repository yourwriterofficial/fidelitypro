import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string };
}

export default function AdminDeposits() {
  const { user } = useAuthStore();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDeposits();
  }, [filter]);

  const fetchDeposits = async () => {
    setLoading(true);
    let query = supabase
      .from('deposits')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error('Failed to load deposits');
    } else {
      setDeposits(data || []);
    }
    setLoading(false);
  };

  const logAdminAction = async (action: string, details: string, targetId: string) => {
    if (!user) return;
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: action,
      target_table: 'deposits',
      target_id: targetId,
      details: { details },
    });
  };

  const updateDepositStatus = async (depositId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('deposits')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', depositId);
      if (error) throw error;

      const deposit = deposits.find(d => d.id === depositId);

      if (newStatus === 'confirmed' && deposit) {
        await supabase.rpc('add_wallet_balance', {
          user_id: deposit.user_id,
          amount: deposit.amount,
        });
        await supabase.from('transactions').insert({
          user_id: deposit.user_id,
          type: 'deposit',
          amount: deposit.amount,
          description: 'Deposit confirmed',
          status: 'completed',
        });
        toast.success(`$${deposit.amount} added to wallet`);
      }

      await logAdminAction(
        `deposit_${newStatus}`,
        `Deposit ${newStatus} for ${deposit?.profiles?.name || deposit?.user_id} of $${deposit?.amount}`,
        depositId
      );

      toast.success(`Deposit ${newStatus}`);
      fetchDeposits();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading deposits...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Deposits</h1>
        <div className="flex gap-2">
          {['all', 'pending', 'confirmed', 'failed'].map((s) => (
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
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-4">{d.profiles?.name || 'N/A'}</td>
                  <td className="p-4">{d.profiles?.email || 'N/A'}</td>
                  <td className="p-4">{formatCurrency(d.amount)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      d.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      d.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="p-4">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="p-4 space-x-2">
                    {d.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateDepositStatus(d.id, 'confirmed')}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckCircle size={20} />
                        </button>
                        <button
                          onClick={() => updateDepositStatus(d.id, 'failed')}
                          className="text-red-600 hover:text-red-800"
                        >
                          <XCircle size={20} />
                        </button>
                      </>
                    )}
                    {d.status === 'confirmed' && (
                      <span className="text-xs text-gray-400"><Clock size={16} className="inline" /> Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {deposits.length === 0 && <p className="p-8 text-gray-500 text-center">No deposits found.</p>}
      </div>
    </div>
  );
}