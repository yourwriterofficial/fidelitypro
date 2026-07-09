import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { RefreshCw, Activity, Filter, Trash2, X, Eye } from 'lucide-react';

interface LogEntry {
  id: string; 
  type: string; 
  user_id: string; 
  user_name: string;
  user_email: string; 
  action: string; 
  details: string;
  amount?: number; 
  status: string; 
  created_at: string;
  db_id: string;
  body?: string;
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
  sent:      'bg-blue-50 text-blue-700 border-blue-100',
};

const TYPE_COLOR: Record<string, string> = {
  withdrawal: 'bg-red-50 text-red-600 border-red-100',
  deposit:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  order:      'bg-blue-50 text-blue-600 border-blue-100',
  staking:    'bg-indigo-50 text-indigo-600 border-indigo-100',
  property:   'bg-orange-50 text-orange-600 border-orange-100',
  transaction:'bg-purple-50 text-purple-600 border-purple-100',
  email:      'bg-blue-50 text-blue-600 border-blue-100',
};

const getStatusBadge = (status: string) =>
  STATUS_BADGE[status] || 'bg-gray-50 text-gray-600 border-gray-100';

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEmailBody, setSelectedEmailBody] = useState<string | null>(null);

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
        { data: emailLogs },
      ] = await Promise.all([
        supabase.from('withdrawals').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('deposits').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id,user_id,product_name,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('staking_orders').select('id,user_id,amount,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('property_investments').select('id,user_id,amount_paid,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('id,user_id,amount,type,description,status,created_at,profiles(name,email)').order('created_at', { ascending: false }).limit(50),
        supabase.from('email_logs').select('id,recipient,subject,body,created_at').order('created_at', { ascending: false }).limit(55),
      ]);

      const toEntry = (item: any, type: string, action: string, details: string, customAmount?: number): LogEntry => ({
        id: `${type}:${item.id}`,
        type,
        user_id: item.user_id,
        user_name: item.profiles?.name || item.user_id || 'Unknown',
        user_email: item.profiles?.email || '',
        action,
        details,
        amount: customAmount !== undefined ? customAmount : item.amount,
        status: item.status || '',
        created_at: item.created_at,
        db_id: item.id
      });

      const merged: LogEntry[] = [
        ...(withdrawals || []).map((w: any) => toEntry(w, 'withdrawal', 'Withdrawal Request', `Amount: $${w.amount}`)),
        ...(deposits || []).map((d: any) => toEntry(d, 'deposit', 'Deposit', `Amount: $${d.amount}`)),
        ...(orders || []).map((o: any) => toEntry(o, 'order', 'Investment Order', `${o.product_name} · $${o.amount}`)),
        ...(stakingOrders || []).map((s: any) => toEntry(s, 'staking', 'Staking Order', `Amount: $${s.amount}`)),
        ...(propertyInvestments || []).map((p: any) => toEntry(p, 'property', 'Property Investment', `Amount: $${p.amount_paid}`, p.amount_paid)),
        ...(transactions || []).map((t: any) => toEntry(t, 'transaction', t.description || 'Transaction', `Type: ${t.type}`)),
        ...(emailLogs || []).map((e: any) => ({
          id: `email:${e.id}`,
          type: 'email',
          user_id: 'system',
          user_name: 'System Outbox',
          user_email: e.recipient,
          action: 'Email Log',
          details: e.subject,
          status: 'sent',
          created_at: e.created_at,
          db_id: e.id,
          body: e.body
        })),
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

  // Single deletion logic
  const handleDeleteSingle = async (dbId: string, type: string) => {
    const tableMap: Record<string, string> = {
      withdrawal: 'withdrawals',
      deposit: 'deposits',
      order: 'orders',
      staking: 'staking_orders',
      property: 'property_investments',
      transaction: 'transactions',
      email: 'email_logs'
    };

    const tableName = tableMap[type];
    if (!tableName) return;

    if (!confirm(`Are you sure you want to permanently delete this ${type} record from the database?`)) return;

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', dbId);
      if (error) throw error;
      toast.success('Entry deleted successfully');
      setSelectedIds(prev => prev.filter(id => id !== `${type}:${dbId}`));
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Bulk Selection and Deletion
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(l => l.id));
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected records from the database?`)) return;

    toast.loading(`Deleting ${selectedIds.length} records...`, { id: 'bulk-delete' });
    try {
      // Group by table name
      const groupings: Record<string, string[]> = {};
      selectedIds.forEach(id => {
        const [type, dbId] = id.split(':');
        const tableMap: Record<string, string> = {
          withdrawal: 'withdrawals',
          deposit: 'deposits',
          order: 'orders',
          staking: 'staking_orders',
          property: 'property_investments',
          transaction: 'transactions',
          email: 'email_logs'
        };
        const tableName = tableMap[type];
        if (tableName) {
          if (!groupings[tableName]) groupings[tableName] = [];
          groupings[tableName].push(dbId);
        }
      });

      // Run deletions in parallel
      await Promise.all(
        Object.entries(groupings).map(async ([table, ids]) => {
          const { error } = await supabase.from(table).delete().in('id', ids);
          if (error) throw error;
        })
      );

      toast.success('Selected records deleted successfully', { id: 'bulk-delete' });
      setSelectedIds([]);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete some records', { id: 'bulk-delete' });
    }
  };

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
        {['all','withdrawal','deposit','order','staking','property','transaction','email'].map(t => (
          <button key={t} onClick={() => { setTypeFilter(t); setSelectedIds([]); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${typeFilter === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Floating Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between rounded-2xl animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={selectedIds.length === filtered.length} 
              onChange={toggleSelectAll}
              className="w-4 h-4 text-brand border-gray-700 bg-slate-800 rounded focus:ring-brand cursor-pointer"
            />
            <span className="text-xs font-semibold">{selectedIds.length} records selected</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedIds([])}
              className="text-xs font-semibold text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeleteBulk}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          </div>
        </div>
      )}

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
                
                {/* Selection checkbox */}
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(log.id)}
                  onChange={() => toggleSelect(log.id)}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-slate-900 shrink-0 cursor-pointer"
                />

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
                    {log.details && <span className="text-xs text-gray-450 font-medium">· {log.details}</span>}
                    {log.type === 'email' && log.body && (
                      <button 
                        onClick={() => setSelectedEmailBody(log.body || null)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <Eye size={10} /> View Email Message
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  {log.amount != null && log.type !== 'email' && <span className="text-sm font-semibold text-gray-700 tabular-nums">{fmt(log.amount)}</span>}
                  {log.status && (
                    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${getStatusBadge(log.status)}`}>{log.status}</span>
                  )}
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                  
                  {/* Delete button */}
                  <button 
                    onClick={() => handleDeleteSingle(log.db_id, log.type)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 ml-1"
                    title="Delete log record"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Body Modal */}
      {selectedEmailBody && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Outbox Email Content</h3>
              <button 
                onClick={() => setSelectedEmailBody(null)} 
                className="p-1.5 hover:bg-gray-150 rounded-xl transition text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm">
              <div 
                className="bg-white border rounded-xl p-6 shadow-sm max-w-full overflow-x-auto" 
                dangerouslySetInnerHTML={{ __html: selectedEmailBody }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
