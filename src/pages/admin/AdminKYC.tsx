import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Search,
  Eye, X, RefreshCw, FileText, Check
} from 'lucide-react';
import { sendEmailAndLog, notifyUser } from '../../lib/notify';

interface KYCRecord {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  nationality?: string;
  document_type: 'passport' | 'national_id' | 'drivers_license';
  document_number: string;
  document_front_url: string;
  document_back_url?: string;
  selfie_url?: string;
  residential_address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  user?: {
    name: string;
    email: string;
    wallet_balance: number;
    kyc_status?: string;
  };
}

export default function AdminKYC() {
  const { profile } = useAuthStore();
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<KYCRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Document image is blurry or unreadable');
  const [customRejectReason, setCustomRejectReason] = useState('');

  // Image zoom modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchKYCRecords = async () => {
    setLoading(true);
    try {
      // 1. Try relational query with explicit foreign key relationship hint
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select(`
          *,
          user:profiles!user_id(name, email, wallet_balance, kyc_status)
        `)
        .order('submitted_at', { ascending: false });

      if (!error && data) {
        setRecords((data as any) || []);
        return;
      }

      // 2. Resilient batch fallback: fetch raw records + profiles in parallel
      const { data: rawRecords, error: rawError } = await supabase
        .from('kyc_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (rawError) throw rawError;
      if (!rawRecords || rawRecords.length === 0) {
        setRecords([]);
        return;
      }

      const userIds = [...new Set(rawRecords.map(r => r.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, wallet_balance, kyc_status')
        .in('id', userIds);

      const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
      const enriched = rawRecords.map(r => ({
        ...r,
        user: profileMap.get(r.user_id) || { name: 'Investor', email: '', wallet_balance: 0 },
      }));

      setRecords(enriched as any);
    } catch (err: any) {
      console.error('Failed to load KYC records:', err);
      toast.error('Could not load KYC submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKYCRecords();
  }, []);

  const handleApprove = async (record: KYCRecord) => {
    if (!profile) return;
    setActionLoading(true);
    try {
      // 1. Update KYC record
      const { error: kycErr } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id,
          rejection_reason: null,
        })
        .eq('id', record.id);

      if (kycErr) throw kycErr;

      // 2. Update user profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'verified',
          kyc_level: 1,
        })
        .eq('id', record.user_id);

      if (profileErr) throw profileErr;

      // 3. In-app notification
      await notifyUser({
        userId: record.user_id,
        title: 'Identity Verification Approved',
        message: 'Your Level 1 KYC Identity Verification has been approved! All account limits and real estate deed conveyance are now fully unlocked.',
        type: 'success',
        link: '/app/settings?tab=kyc',
      });

      // 4. Email notification
      if (record.user?.email) {
        await sendEmailAndLog(
          record.user.email,
          '[RPM] Identity Verification Approved (Level 1 KYC)',
          `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #00674F; margin: 0; font-size: 24px;">Verification Approved</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Level 1 Identity Compliance Complete</p>
              </div>
              <p>Hello <strong>${record.first_name} ${record.last_name}</strong>,</p>
              <p>Congratulations! Your submitted identity documents have been verified and approved by our compliance team.</p>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-weight: bold;">Unlocked Privileges:</p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #15803d; font-size: 14px;">
                  <li>Real Estate Property Title Conveyance & Deed Ownership</li>
                  <li>Higher Daily Withdrawal Limits ($1,000,000 USD / day)</li>
                  <li>P2P Express & Escrow Clearing Desk Access</li>
                  <li>Institutional Fixed Yield Staking</li>
                </ul>
              </div>
              <div style="text-align: center; margin-top: 28px;">
                <a href="${window.location.origin}/app/settings?tab=kyc" style="background: #00674F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  View Account Verification
                </a>
              </div>
            </div>
          `
        );
      }

      toast.success(`Approved KYC for ${record.first_name} ${record.last_name}`);
      setSelectedRecord(null);
      await fetchKYCRecords();
    } catch (err: any) {
      console.error('Approval failed:', err);
      toast.error(err.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!profile || !selectedRecord) return;
    const finalReason = rejectReason === 'Other (specify below)' ? customRejectReason.trim() : rejectReason;
    if (!finalReason) {
      toast.error('Please specify a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Update KYC record
      const { error: kycErr } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id,
          rejection_reason: finalReason,
        })
        .eq('id', selectedRecord.id);

      if (kycErr) throw kycErr;

      // 2. Update user profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'rejected',
        })
        .eq('id', selectedRecord.user_id);

      if (profileErr) throw profileErr;

      // 3. In-app notification
      await notifyUser({
        userId: selectedRecord.user_id,
        title: 'Identity Verification Update',
        message: `Your KYC verification requires attention: ${finalReason}. Please visit Settings to re-submit valid documents.`,
        type: 'warning',
        link: '/app/settings?tab=kyc',
      });

      // 4. Email notification
      if (selectedRecord.user?.email) {
        await sendEmailAndLog(
          selectedRecord.user.email,
          '[RPM] Action Required: Identity Verification Update',
          `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #b91c1c; margin-top: 0;">Identity Verification Requires Attention</h2>
              <p>Hello <strong>${selectedRecord.first_name} ${selectedRecord.last_name}</strong>,</p>
              <p>Our compliance team reviewed your submitted documents, but was unable to complete verification for the following reason:</p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 18px 0; color: #991b1b; font-weight: 500;">
                "${finalReason}"
              </div>
              <p style="font-size: 14px; color: #475569;">Please log into your account, visit Settings &gt; Identity Verification, and upload clear, valid documentation.</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${window.location.origin}/app/settings?tab=kyc" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Re-submit Verification
                </a>
              </div>
            </div>
          `
        );
      }

      toast.success('KYC submission marked as rejected');
      setRejectModalOpen(false);
      setSelectedRecord(null);
      await fetchKYCRecords();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      toast.error(err.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = `${r.first_name} ${r.last_name}`.toLowerCase().includes(q);
      const matchEmail = r.user?.email?.toLowerCase().includes(q);
      const matchDoc = r.document_number?.toLowerCase().includes(q);
      const matchCountry = r.country?.toLowerCase().includes(q) || r.nationality?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchDoc && !matchCountry) return false;
    }
    return true;
  });

  const pendingCount = records.filter(r => r.status === 'pending').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-brand" size={28} /> KYC Identity Verifications
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review user passports, national IDs, selfies, and approve compliance levels.
          </p>
        </div>
        <button
          onClick={fetchKYCRecords}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Queue
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Submissions</span>
          <span className="text-2xl font-extrabold text-gray-900 mt-1 block">{records.length}</span>
        </div>
        <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/70 shadow-sm">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Pending Review</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-extrabold text-amber-900">{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
        </div>
        <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200/70 shadow-sm">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Verified (Level 1)</span>
          <span className="text-2xl font-extrabold text-emerald-900 mt-1 block">{approvedCount}</span>
        </div>
        <div className="bg-red-50/60 p-5 rounded-2xl border border-red-200/70 shadow-sm">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">Rejected</span>
          <span className="text-2xl font-extrabold text-red-900 mt-1 block">{rejectedCount}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition ${
                filterStatus === tab
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? `All (${records.length})` : `${tab} (${records.filter(r => r.status === tab).length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, doc #..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
      </div>

      {/* KYC Submissions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <ShieldCheck size={40} className="text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-gray-700 text-sm">No KYC submissions found</p>
            <p className="text-xs text-gray-400 mt-0.5">Submissions will show up here as users complete identity verification.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Legal Name</th>
                  <th className="px-5 py-3.5">Document</th>
                  <th className="px-5 py-3.5">Nationality / Region</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-bold text-gray-900 block">{r.user?.name || 'Investor'}</span>
                        <span className="text-gray-400 text-[11px] block">{r.user?.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-800">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-bold text-gray-900 uppercase block">{r.document_type.replace('_', ' ')}</span>
                        <span className="font-mono text-gray-500 text-[11px] block">{r.document_number}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 font-medium">
                      {r.nationality || r.country || 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : r.status === 'rejected'
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {r.status === 'approved' && <CheckCircle2 size={12} />}
                        {r.status === 'rejected' && <XCircle size={12} />}
                        {r.status === 'pending' && <Clock size={12} />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(r.submitted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedRecord(r)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-brand hover:text-white text-gray-700 font-bold rounded-xl transition inline-flex items-center gap-1 text-[11px]"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KYC Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-brand/10 rounded-2xl flex items-center justify-center text-brand font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-gray-900">
                    KYC Submission: {selectedRecord.first_name} {selectedRecord.last_name}
                  </h3>
                  <p className="text-xs text-gray-400">{selectedRecord.user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Document Type</span>
                <span className="font-bold text-gray-900 uppercase block mt-0.5">{selectedRecord.document_type.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Document ID Number</span>
                <span className="font-bold text-gray-900 font-mono block mt-0.5">{selectedRecord.document_number}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Date of Birth</span>
                <span className="font-bold text-gray-900 block mt-0.5">{selectedRecord.dob || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Nationality</span>
                <span className="font-bold text-gray-900 block mt-0.5">{selectedRecord.nationality || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Country / City</span>
                <span className="font-bold text-gray-900 block mt-0.5">{selectedRecord.city || ''}, {selectedRecord.country || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Residential Address</span>
                <span className="font-bold text-gray-900 block mt-0.5">{selectedRecord.residential_address || 'N/A'}</span>
              </div>
            </div>

            {/* Uploaded Documents Grid */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                <FileText size={15} className="text-brand" /> Uploaded Verification Images (Click to Zoom)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Front */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-600 block">ID / Document Front</span>
                  <div
                    onClick={() => setZoomedImage(selectedRecord.document_front_url)}
                    className="relative group cursor-pointer bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 aspect-4/3 flex items-center justify-center hover:ring-2 hover:ring-brand"
                  >
                    <img
                      src={selectedRecord.document_front_url}
                      alt="Front"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                      <Eye size={14} /> Zoom
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-600 block">ID Document Back</span>
                  {selectedRecord.document_back_url ? (
                    <div
                      onClick={() => setZoomedImage(selectedRecord.document_back_url!)}
                      className="relative group cursor-pointer bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 aspect-4/3 flex items-center justify-center hover:ring-2 hover:ring-brand"
                    >
                      <img
                        src={selectedRecord.document_back_url}
                        alt="Back"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye size={14} /> Zoom
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 aspect-4/3 flex items-center justify-center text-gray-400 text-xs">
                      Not required / Passport
                    </div>
                  )}
                </div>

                {/* Selfie */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-600 block">Facial Verification Selfie</span>
                  {selectedRecord.selfie_url ? (
                    <div
                      onClick={() => setZoomedImage(selectedRecord.selfie_url!)}
                      className="relative group cursor-pointer bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 aspect-4/3 flex items-center justify-center hover:ring-2 hover:ring-brand"
                    >
                      <img
                        src={selectedRecord.selfie_url}
                        alt="Selfie"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye size={14} /> Zoom
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 aspect-4/3 flex items-center justify-center text-gray-400 text-xs">
                      No selfie uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Current status info */}
            {selectedRecord.status === 'rejected' && selectedRecord.rejection_reason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800">
                <span className="font-bold block">Rejection Reason:</span>
                <p className="mt-0.5">{selectedRecord.rejection_reason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleApprove(selectedRecord)}
                className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md transition disabled:opacity-60"
              >
                {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                Approve & Verify User (Level 1)
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectModalOpen(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md transition disabled:opacity-60"
              >
                <XCircle size={16} /> Reject Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Reject KYC Submission</h3>
              <button onClick={() => setRejectModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Select Reason</label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="Document image is blurry or unreadable">Document image is blurry or unreadable</option>
                <option value="Document is expired or invalid">Document is expired or invalid</option>
                <option value="Name on ID does not match account name">Name on ID does not match account name</option>
                <option value="Selfie does not match photo on identity document">Selfie does not match photo on identity document</option>
                <option value="Back of ID document missing">Back of ID document missing</option>
                <option value="Other (specify below)">Other (specify below)</option>
              </select>
            </div>

            {rejectReason === 'Other (specify below)' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Custom Reason</label>
                <textarea
                  value={customRejectReason}
                  onChange={e => setCustomRejectReason(e.target.value)}
                  placeholder="Explain why the verification was rejected..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm disabled:opacity-60"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition p-2"
            >
              <X size={24} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
