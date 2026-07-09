import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Search, Mail, Eye, X, Calendar, RefreshCw } from 'lucide-react';

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  created_at: string;
}

export default function AdminEmailLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchLogs();
  }, [page, searchTerm]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`recipient.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`);
      }

      // Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch email logs');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Outbound Email Logs</h1>
          <p className="text-gray-500 text-sm mt-1">Audit and troubleshoot system-generated email dispatches.</p>
        </div>
        <button 
          onClick={() => { setPage(1); fetchLogs(); }}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shrink-0 flex items-center gap-2 text-sm text-gray-600 font-semibold"
        >
          <RefreshCw size={15} /> Refresh Logs
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by recipient email or subject..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Sent At</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">Loading outbound logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">No outbound email logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-55/30 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">{log.recipient}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{log.subject}</td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition"
                      >
                        <Eye size={13} /> View Body
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col z-10 overflow-hidden border">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand/10 text-brand rounded-lg shrink-0">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Email Dispatch details</h3>
                  <p className="text-xs text-gray-400">To: {selectedLog.recipient}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 bg-gray-50/30 flex-1">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Subject</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selectedLog.subject}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Body Preview</span>
                <div className="border border-gray-250 bg-white rounded-xl overflow-hidden mt-1.5 h-96">
                  {/* Safely render HTML using iframe sandbox srcDoc */}
                  <iframe
                    title="Email preview"
                    srcDoc={selectedLog.body}
                    sandbox=""
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
