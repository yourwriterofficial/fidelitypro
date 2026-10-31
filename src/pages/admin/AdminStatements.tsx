import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { notifyUser } from '../../lib/notify';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Eye,
  DollarSign,
  ShieldCheck,
  Printer,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatementRequest {
  id: string;
  user_id: string;
  statement_type: string;
  print_fee: number;
  payment_proof_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  profiles: {
    name: string;
    email: string;
    wallet_balance: number;
  } | null;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function StatusBadge({ status }: { status: StatementRequest['status'] }) {
  const map = {
    pending: {
      label: 'Pending',
      icon: <Clock className="w-3.5 h-3.5" />,
      cls: 'bg-amber-100 text-amber-700 border border-amber-200',
    },
    approved: {
      label: 'Approved',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    },
    rejected: {
      label: 'Rejected',
      icon: <XCircle className="w-3.5 h-3.5" />,
      cls: 'bg-red-100 text-red-700 border border-red-200',
    },
  };

  const { label, icon, cls } = map[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-100">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 bg-gray-200 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminStatements() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<StatementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Per-row reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Legal Payout Receipt Modal State (Admin only — Dean McMahon, Esq. for Wayne Bobo / users)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('statement_print_requests')
      .select(`*, profiles:user_id (name, email, wallet_balance)`)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load statement requests');
    } else {
      setRequests((data as StatementRequest[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  const filtered =
    activeTab === 'all' ? requests : requests.filter((r) => r.status === activeTab);

  // ── Approve ────────────────────────────────────────────────────────────────

  const handleApprove = async (req: StatementRequest) => {
    if (!user?.id) return;
    setProcessingId(req.id);

    try {
      const { error } = await supabase
        .from('statement_print_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          admin_note: null,
        })
        .eq('id', req.id);

      if (error) throw error;

      await notifyUser({
        userId: req.user_id,
        title: 'Account Statement Ready',
        message:
          'Your account statement print request has been approved. You may now print your certified statement.',
        type: 'success',
        link: '/app/wallet',
      });

      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? {
                ...r,
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: user.id,
                admin_note: null,
              }
            : r
        )
      );

      toast.success(`Statement request approved for ${req.profiles?.name ?? 'user'}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────

  const handleReject = async (req: StatementRequest) => {
    if (!user?.id) return;
    setProcessingId(req.id);

    try {
      const { error } = await supabase
        .from('statement_print_requests')
        .update({
          status: 'rejected',
          admin_note: adminNote.trim() || null,
        })
        .eq('id', req.id);

      if (error) throw error;

      await notifyUser({
        userId: req.user_id,
        title: 'Statement Request Declined',
        message:
          'Your account statement print request has been declined. Please contact support for more information.',
        type: 'warning',
        link: '/app/wallet',
      });

      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? { ...r, status: 'rejected', admin_note: adminNote.trim() || null }
            : r
        )
      );

      toast.success(`Statement request rejected for ${req.profiles?.name ?? 'user'}`);
      setRejectingId(null);
      setAdminNote('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#00674F]/10 rounded-xl">
            <FileText className="w-6 h-6 text-[#00674F]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Statement Print Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Review and action user account statement print requests.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/admin/receipts')}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-xs font-bold shrink-0 shadow-sm"
          title="Legal Disbursement Receipts Desk (Dean McMahon, Esq.)"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Disbursement Receipts</span>
        </button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats.total}
          icon={<FileText className="w-5 h-5 text-[#00674F]" />}
          accent="bg-[#00674F]/10"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          accent="bg-amber-100"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          accent="bg-emerald-100"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          accent="bg-red-100"
        />
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filter Tabs */}
        <div className="border-b border-gray-200 px-4 pt-4 flex gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === key
                  ? 'bg-[#00674F] text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
              {key !== 'all' && (
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {stats[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Statement Type</th>
                <th className="px-4 py-3 font-semibold">Fee</th>
                <th className="px-4 py-3 font-semibold">Payment Proof</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No requests found</p>
                    <p className="text-xs mt-1">
                      {activeTab !== 'all'
                        ? `There are no ${activeTab} statement requests.`
                        : 'No statement print requests have been submitted yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <>
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">
                          {req.profiles?.name ?? '—'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {req.profiles?.email ?? '—'}
                        </div>
                        {req.profiles?.wallet_balance !== undefined && (
                          <div className="text-xs text-[#00674F] font-medium mt-0.5 flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(req.profiles.wallet_balance)}
                          </div>
                        )}
                      </td>

                      {/* Statement Type */}
                      <td className="px-4 py-3">
                        <span className="capitalize text-gray-700 font-medium">
                          {req.statement_type?.replace(/_/g, ' ') ?? '—'}
                        </span>
                      </td>

                      {/* Fee */}
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {formatCurrency(req.print_fee ?? 0)}
                      </td>

                      {/* Payment Proof */}
                      <td className="px-4 py-3">
                        {req.payment_proof_url ? (
                          <a
                            href={req.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#00674F] hover:underline text-xs font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Proof
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">None provided</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDate(req.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                        {req.admin_note && req.status === 'rejected' && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[160px] truncate" title={req.admin_note}>
                            Note: {req.admin_note}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={processingId === req.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#00674F] hover:bg-[#005540] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {processingId === req.id ? 'Processing…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingId(req.id);
                                setAdminNote('');
                              }}
                              disabled={processingId === req.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 italic">
                              {req.status === 'approved' && req.approved_at
                                ? `Approved ${formatDate(req.approved_at)}`
                                : 'Completed'}
                            </span>
                            <button
                              onClick={() => {
                                const name = req.profiles?.name || '';
                                const ref = `RPM-ACC-${req.user_id.slice(0, 6).toUpperCase()}-2026`;
                                const amt = req.profiles?.wallet_balance || 78958.0;
                                navigate(`/admin/receipts?userId=${req.user_id}&name=${encodeURIComponent(name)}&ref=${encodeURIComponent(ref)}&amount=${amt}`);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition shadow-xs"
                              title="Open Legal Disbursement Receipt Desk"
                            >
                              <Printer className="w-3 h-3 text-emerald-400" />
                              Receipt
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Inline reject form row */}
                    {rejectingId === req.id && (
                      <tr key={`${req.id}-reject`} className="bg-red-50 border-b border-red-100">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex-1 w-full">
                              <label className="text-xs font-semibold text-red-700 mb-1 block">
                                Admin Note (optional)
                              </label>
                              <input
                                type="text"
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="Reason for rejection…"
                                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                                autoFocus
                              />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleReject(req)}
                                disabled={processingId === req.id}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingId === req.id ? 'Rejecting…' : 'Confirm Reject'}
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setAdminNote('');
                                }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span>
              Showing {filtered.length} of {requests.length} requests
            </span>
            <button
              onClick={fetchRequests}
              className="text-[#00674F] hover:underline font-medium"
            >
              Refresh
            </button>
          </div>
        )}
      </div>


    </div>
  );
}
