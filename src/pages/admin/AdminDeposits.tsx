import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Clock, X, Image as ImageIcon,
  ExternalLink, RefreshCw, DollarSign
} from 'lucide-react';
import { notifyUser } from '../../lib/notify';

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  transaction_hash?: string;
  proof_url?: string;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string };
}

export default function AdminDeposits() {
  const { user } = useAuthStore();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchDeposits();
  }, [filter]);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('deposits')
        .select('*, profiles(name, email)')
        .order('created_at', { ascending: false });
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setDeposits(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load deposits');
    } finally {
      setLoading(false);
    }
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
    if (processingId) return;
    setProcessingId(depositId);
    try {
      const { data, error } = await supabase
        .from('deposits')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', depositId)
        .eq('status', 'pending')
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('This deposit has already been processed.');
        fetchDeposits();
        return;
      }

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
          description: `Deposit confirmed (${deposit.transaction_hash || 'Crypto Deposit'})`,
          status: 'completed',
        });
        toast.success(`$${deposit.amount} added to wallet`);

        // Notify user in-app
        await notifyUser({
          userId: deposit.user_id,
          title: 'Deposit Confirmed',
          message: `Your deposit of $${deposit.amount.toLocaleString()} has been confirmed and credited to your wallet balance.`,
          type: 'success',
          link: '/app/wallet',
        });

        // Check and lift restrictions if deposit satisfies the fee requirement
        const { data: profile } = await supabase
          .from('profiles')
          .select('fee_required')
          .eq('id', deposit.user_id)
          .single();
        if (profile && profile.fee_required > 0 && deposit.amount >= profile.fee_required) {
          await supabase.from('profiles').update({
            can_withdraw: true,
            can_invest: true,
            can_stake: true,
            can_property: true,
            restriction_reason: null,
            fee_required: 0,
          }).eq('id', deposit.user_id);
          toast.success('Account restrictions lifted automatically.');
        }
      } else if (newStatus === 'failed' && deposit) {
        await notifyUser({
          userId: deposit.user_id,
          title: 'Deposit Rejected',
          message: `Your deposit request for $${deposit.amount.toLocaleString()} could not be verified on the blockchain.`,
          type: 'alert',
          link: '/app/wallet',
        });
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
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="text-brand" size={28} /> Deposit Verification Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Inspect user transfer payment screenshots and credit wallet balances.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchDeposits}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {['all', 'pending', 'confirmed', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition ${filter === s ? 'bg-brand text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Deposit Asset / Network</th>
                  <th className="p-4">Payment Proof</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/60 transition">
                    <td className="p-4">
                      <span className="font-bold text-gray-900 block">{d.profiles?.name || 'N/A'}</span>
                      <span className="text-gray-400 text-[11px] block">{d.profiles?.email}</span>
                    </td>
                    <td className="p-4 font-extrabold text-gray-900 text-sm">{formatCurrency(d.amount)}</td>
                    <td className="p-4">
                      <span className="font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {d.transaction_hash || 'USDT (TRC20)'}
                      </span>
                    </td>
                    <td className="p-4">
                      {d.proof_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewProofUrl(d.proof_url!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold hover:bg-indigo-100 transition"
                        >
                          <ImageIcon size={14} /> View Proof
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${
                        d.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        d.status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 whitespace-nowrap">
                      {new Date(d.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {d.status === 'pending' && (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => updateDepositStatus(d.id, 'confirmed')}
                            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition disabled:opacity-40"
                            title="Confirm & Credit Wallet"
                            disabled={processingId === d.id}
                          >
                            <CheckCircle size={17} />
                          </button>
                          <button
                            onClick={() => updateDepositStatus(d.id, 'failed')}
                            className="p-2 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white rounded-xl transition disabled:opacity-40"
                            title="Mark as Failed"
                            disabled={processingId === d.id}
                          >
                            <XCircle size={17} />
                          </button>
                        </div>
                      )}
                      {d.status === 'confirmed' && (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                          <Clock size={13} /> Credited
                        </span>
                      )}
                      {d.status === 'failed' && (
                        <span className="text-[11px] font-semibold text-red-600">
                          Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {deposits.length === 0 && !loading && (
          <p className="p-12 text-gray-400 text-center font-medium text-xs">No deposits found in this filter.</p>
        )}
      </div>

      {/* Proof Preview Modal */}
      {previewProofUrl && (
        <div
          onClick={() => setPreviewProofUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ImageIcon size={18} className="text-brand" /> Deposit Payment Evidence
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand transition"
                  title="Open in new tab"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setPreviewProofUrl(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl overflow-hidden max-h-[70vh] flex items-center justify-center border border-gray-200">
              <img
                src={previewProofUrl}
                alt="Deposit Evidence"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}