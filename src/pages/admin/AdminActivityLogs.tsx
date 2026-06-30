import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { RefreshCw, Activity, Filter } from 'lucide-react';

interface LogEntry {
  id: string; type: string; user_id: string; user_name: string;
  user_email: string; action: string; details: string;
  amount?: number; status: string; created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-100',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  completed: 'bg-blue-50 text-blue-700 border-blue-100',
  rejected:  'bg-red-50 text-red-700 border-red-100',
  failed:    'bg-red-50 text-red-700 border-red-100',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-100',
};

const TYPE_COLOR: Record<string, string> = {
  withdrawal: 'bg-red-50 text-red-600 border-red-100',
  deposit:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  order:      'bg-blue-50 text-blue-600 border-blue-100',
  staking:    'bg-indigo-50 text-indigo-600 border-indigo-100',
  property:   'bg-orange-50 text-orange-600 border-orange-100',
  transaction:'bg-purple-50 text-purple-600 border-purple-100',
};

const getStatusBadge = (status: string) =>
  STATUS_BADGE[status] || 'bg-gray-50 text-gray-600 border-gray-100';

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [
        { data: withdrawals },
        { data: deposits },
        { data: orders },
        { data: stakingOrders },
        { data: propertyInvestments },
        { data: transactions },
      ] = await Promise.all([
        supabase.from('withdrawals').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('deposits').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id,user_id,product_name,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('staking_orders').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('property_investments').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('id,user_id,amount,type,description,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
      ]);

      const toEntry = (item: any, type: string, action: string, details: string): LogEntry => ({
        id: `${type}-${item.id}`,
        type,
        user_id: item.user_id,
        user_name: item.profiles?.name || item.user_id || 'Unknown',
        user_email: item.profiles?.email || '',
        action,
        details,
        amount: item.amount,
        status: item.status || '',
        created_at: item.created_at,
      });

      const merged: LogEntry[] = [
        ...(withdrawals || []).map((w: any) => toEntry(w, 'withdrawal', 'Withdrawal Request', `Amount: $${w.amount}`)),
        ...(deposits || []).map((d: any) => toEntry(d, 'deposit', 'Deposit', `Amount: $${d.amount}`)),
        ...(orders || []).map((o: any) => toEntry(o, 'order', 'Investment Order', `${o.product_name} · $${o.amount}`)),
        ...(stakingOrders || []).map((s: any) => toEntry(s, 'staking', 'Staking Order', `Amount: $${s.amount}`)),
        ...(propertyInvestments || []).map((p: any) => toEntry(p, 'property', 'Property Investment', `Amount: $${p.amount}`)),
        ...(transactions || []).map((t: any) => toEntry(t, 'transaction', t.description || 'Transaction', `Type: ${t.type}`)),
      ];

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLogs(merged);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = typeFilter === 'all' ? logs : logs.filter(l => l.type === typeFilter);
  const fmt = (n?: number) => n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} entries across all activity types</p>
        </div>
        <button onClick={fetchLogs} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mr-1"><Filter size={14} /> Filter:</div>
        {['all','withdrawal','deposit','order','staking','property','transaction'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${typeFilter === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-0 divide-y divide-gray-50">
            {[...Array(8)].map((_, i) => <div key={i} className="animate-pulse h-16 bg-gray-50/50 m-0" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Activity size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No activity logs found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                  {log.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{log.user_name}</span>
                    {log.user_email && <span className="text-xs text-gray-400">{log.user_email}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${TYPE_COLOR[log.type] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>{log.type}</span>
                    <span className="text-xs text-gray-500">{log.action}</span>
                    {log.details && <span className="text-xs text-gray-400">· {log.details}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {log.amount != null && <span className="text-sm font-semibold text-gray-700 tabular-nums">{fmt(log.amount)}</span>}
                  {log.status && (
                    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${getStatusBadge(log.status)}`}>{log.status}</span>
                  )}
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
