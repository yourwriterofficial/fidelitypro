import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface LogEntry {
  id: string;
  type: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  action: string;
  details: string;
  amount?: number;
  status?: string;
  created_at: string;
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch withdrawals
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id, user_id, amount, address, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch deposits
      const { data: deposits } = await supabase
        .from('deposits')
        .select('id, user_id, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch orders (investments)
      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id, product_name, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch staking orders
      const { data: staking } = await supabase
        .from('staking_orders')
        .select('id, user_id, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch property investments
      const { data: properties } = await supabase
        .from('property_investments')
        .select('id, user_id, amount_paid, status, created_at, property:property_id(title), profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, user_id, type, amount, description, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      // Build unified log entries
      const allLogs: LogEntry[] = [];

      withdrawals?.forEach((w) => {
        allLogs.push({
          id: w.id,
          type: 'withdrawal',
          user_id: w.user_id,
          user_name: (w.profiles as any)?.name,
          user_email: (w.profiles as any)?.email,
          action: 'Withdrawal',
          details: `Withdrawal of $${w.amount} to ${w.address}`,
          amount: w.amount,
          status: w.status,
          created_at: w.created_at,
        });
      });

      deposits?.forEach((d) => {
        allLogs.push({
          id: d.id,
          type: 'deposit',
          user_id: d.user_id,
          user_name: (d.profiles as any)?.name,
          user_email: (d.profiles as any)?.email,
          action: 'Deposit',
          details: `Deposit of $${d.amount}`,
          amount: d.amount,
          status: d.status,
          created_at: d.created_at,
        });
      });

      orders?.forEach((o) => {
        allLogs.push({
          id: o.id,
          type: 'investment',
          user_id: o.user_id,
          user_name: (o.profiles as any)?.name,
          user_email: (o.profiles as any)?.email,
          action: 'Investment',
          details: `Investment in ${o.product_name} of $${o.amount}`,
          amount: o.amount,
          status: o.status,
          created_at: o.created_at,
        });
      });

      staking?.forEach((s) => {
        allLogs.push({
          id: s.id,
          type: 'staking',
          user_id: s.user_id,
          user_name: (s.profiles as any)?.name,
          user_email: (s.profiles as any)?.email,
          action: 'Staking',
          details: `Staking of $${s.amount}`,
          amount: s.amount,
          status: s.status,
          created_at: s.created_at,
        });
      });

      properties?.forEach((p) => {
        allLogs.push({
          id: p.id,
          type: 'property',
          user_id: p.user_id,
          user_name: (p.profiles as any)?.name,
          user_email: (p.profiles as any)?.email,
          action: 'Property Investment',
          details: `Paid $${p.amount_paid} for ${(p.property as any)?.title || 'property'}`,
          amount: p.amount_paid,
          status: p.status,
          created_at: p.created_at,
        });
      });

      transactions?.forEach((t) => {
        allLogs.push({
          id: t.id,
          type: t.type,
          user_id: t.user_id,
          user_name: (t.profiles as any)?.name,
          user_email: (t.profiles as any)?.email,
          action: t.type === 'admin' ? 'Admin Action' : t.type,
          details: t.description || t.type,
          amount: t.amount,
          status: t.status,
          created_at: t.created_at,
        });
      });

      // Sort by most recent
      allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply filter
      let filtered = allLogs;
      if (filter !== 'all') {
        filtered = allLogs.filter(log => log.type === filter);
      }

      setLogs(filtered);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      confirmed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      withdrawn_early: 'bg-orange-100 text-orange-700',
      defaulted: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) return <div>Loading logs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand"
          >
            <option value="all">All</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="deposit">Deposits</option>
            <option value="investment">Investments</option>
            <option value="staking">Staking</option>
            <option value="property">Property</option>
            <option value="admin">Admin</option>
            <option value="return">Returns</option>
          </select>
          <button
            onClick={fetchLogs}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Action</th>
                <th className="text-left p-4">Details</th>
                <th className="text-left p-4">Amount</th>
                <th className="text-left p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No logs found.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-4">{log.user_name || log.user_email || log.user_id}</td>
                    <td className="p-4">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-xs text-gray-400 ml-1">({log.type})</span>
                    </td>
                    <td className="p-4 max-w-xs truncate">{log.details}</td>
                    <td className="p-4">{log.amount ? formatCurrency(log.amount) : '—'}</td>
                    <td className="p-4">
                      {log.status && (
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(log.status)}`}>
                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}