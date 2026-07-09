import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Wallet, ArrowDownLeft, ArrowUpRight, DollarSign, Calendar, X } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'investment' | 'staking' | 'bonus' | 'referral';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'rejected';
  created_at: string;
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id, typeFilter, page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setTransactions(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (n: number) => {
    const absVal = Math.abs(n);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(absVal);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 py-8 pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Transaction History</h1>
        <p className="text-gray-500 text-sm mt-1">Review all your account debits, credits, and investments.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-1">
        {[
          { id: 'all', label: 'All Activity' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'withdrawal', label: 'Withdrawals' },
          { id: 'investment', label: 'Investments' },
          { id: 'staking', label: 'Staking' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setTypeFilter(tab.id); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
              typeFilter === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading history...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 space-y-2">
            <Wallet size={36} className="text-gray-250 mx-auto" />
            <p className="font-bold text-gray-700">No Transactions Found</p>
            <p className="text-xs text-gray-400">Your logged financial activity will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {transactions.map((tx) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <tr 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-gray-50/50 cursor-pointer transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50/70 text-red-500'
                          }`}>
                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate max-w-xs">{tx.description}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">ID: {tx.id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          tx.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          tx.status === 'pending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${
                        isCredit ? 'text-emerald-600' : 'text-red-550'
                      }`}>
                        {isCredit ? '+' : '-'}{fmtCurrency(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white hover:bg-gray-50 transition disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white hover:bg-gray-50 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 border relative overflow-hidden">
            <button onClick={() => setSelectedTx(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-2xl ${
                selectedTx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
              }`}>
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-950 text-base">Transaction Details</h3>
                <p className="text-xs text-gray-400">ID: {selectedTx.id}</p>
              </div>
            </div>

            <div className="space-y-4 text-sm border-t border-b py-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Description</span>
                <span className="font-semibold text-gray-900 text-right max-w-xs">{selectedTx.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category Type</span>
                <span className="capitalize font-semibold text-gray-900">{selectedTx.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created At</span>
                <span className="font-semibold text-gray-900">{new Date(selectedTx.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`capitalize font-semibold ${
                  selectedTx.status === 'completed' ? 'text-emerald-600' :
                  selectedTx.status === 'pending' ? 'text-amber-600' : 'text-red-550'
                }`}>{selectedTx.status}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <span className="text-sm font-semibold text-gray-500">Amount Charged</span>
              <span className={`text-xl font-bold ${
                selectedTx.amount > 0 ? 'text-emerald-600' : 'text-red-550'
              }`}>
                {selectedTx.amount > 0 ? '+' : '-'}{fmtCurrency(selectedTx.amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
