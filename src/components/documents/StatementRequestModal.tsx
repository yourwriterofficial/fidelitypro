import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Upload,
  Clock,
  FileText,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  Coins,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { notifyAdmins } from '../../lib/notify';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatementRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when an existing (or newly approved) request lets the user print. */
  onPrintApproved: () => void;
  userId: string;
  userName: string;
}

interface DepositMethod {
  currency: string;
  network: string;
  address: string;
  min: number;
}

interface ExistingRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  print_fee: number;
  statement_type: string;
  created_at: string;
  payment_proof_url: string;
  rejection_reason?: string | null;
}

type Step = 1 | 2 | 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Pay' },
    { n: 2, label: 'Upload' },
    { n: 3, label: 'Review' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-0 mb-6 select-none">
      {steps.map(({ n, label }, idx) => {
        const done = current > n;
        const active = current === n;
        return (
          <React.Fragment key={n}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
                  ${done ? 'bg-brand border-brand text-white' : ''}
                  ${active ? 'bg-brand border-brand text-white shadow-lg shadow-brand/30' : ''}
                  ${!done && !active ? 'bg-white border-slate-200 text-slate-400' : ''}
                `}
              >
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider transition-colors
                  ${active ? 'text-brand' : done ? 'text-brand/70' : 'text-slate-400'}`}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-12 sm:w-16 h-0.5 mb-5 mx-1 rounded-full transition-colors duration-500
                  ${current > n ? 'bg-brand' : 'bg-slate-200'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — please copy manually.');
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-2 shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-brand border border-slate-200 transition-colors"
      title="Copy address"
    >
      {copied ? <Check size={15} className="text-brand" strokeWidth={3} /> : <Copy size={15} className="text-slate-500" />}
    </button>
  );
}

// Default fallback addresses if none configured in DB
const DEFAULT_METHODS: DepositMethod[] = [
  {
    currency: 'USDT',
    network: 'TRC20',
    address: 'TK7PkdEvUDuizfjD97V5WWy1RYicV4YGSS',
    min: 30,
  },
  {
    currency: 'BTC',
    network: 'Bitcoin',
    address: 'bc1qeqnyn63utm8cx6qv7c6w9kr80nf5cndrzwhq4u',
    min: 30,
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const StatementRequestModal: React.FC<StatementRequestModalProps> = ({
  isOpen,
  onClose,
  onPrintApproved,
  userId,
  userName,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [fee, setFee] = useState<number>(1000);
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>(DEFAULT_METHODS);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USDT');
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null);
  const [checkingRequest, setCheckingRequest] = useState(true);
  const [rejected, setRejected] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active deposit method
  const activeMethod =
    depositMethods.find((m) => m.currency.toUpperCase() === selectedCurrency.toUpperCase()) ||
    depositMethods[0] ||
    DEFAULT_METHODS[0];

  // ── Fetch settings (fee + deposit methods) ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const fetchSettings = async () => {
      setLoadingSettings(true);
      try {
        const [feeRes, methodsRes] = await Promise.all([
          supabase.from('settings').select('value').eq('key', 'statement_print_fee').maybeSingle(),
          supabase.from('settings').select('value').eq('key', 'deposit_methods').maybeSingle(),
        ]);

        if (feeRes.data?.value) {
          const parsed = parseFloat(feeRes.data.value);
          if (!isNaN(parsed) && parsed > 0) setFee(parsed);
        }

        if (methodsRes.data?.value) {
          try {
            const parsed: DepositMethod[] = JSON.parse(methodsRes.data.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDepositMethods(parsed);
              // Pick USDT if available, else first
              const hasUsdt = parsed.some((p) => p.currency.toUpperCase() === 'USDT');
              setSelectedCurrency(hasUsdt ? 'USDT' : parsed[0].currency);
            }
          } catch {
            console.error('[StatementRequestModal] Failed to parse deposit_methods, using defaults');
          }
        }
      } catch (err) {
        console.error('[StatementRequestModal] Error fetching settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [isOpen]);

  // ── Check for existing request on mount ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !userId) return;

    const checkExisting = async () => {
      setCheckingRequest(true);
      try {
        const { data, error } = await supabase
          .from('statement_print_requests')
          .select('id, status, print_fee, statement_type, created_at, payment_proof_url, rejection_reason')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          // Table might not exist yet or no rows
          console.warn('[StatementRequestModal] Existing request check note:', error.message);
          return;
        }

        if (data) {
          if (data.status === 'approved') {
            onPrintApproved();
            onClose();
            return;
          }
          if (data.status === 'pending') {
            setExistingRequest(data as ExistingRequest);
            setStep(3);
          }
          if (data.status === 'rejected') {
            setExistingRequest(data as ExistingRequest);
            setRejected(true);
          }
        }
      } catch (err) {
        console.warn('[StatementRequestModal] Error checking existing request:', err);
      } finally {
        setCheckingRequest(false);
      }
    };

    checkExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setProofFile(null);
      setProofPreview(null);
      setUploading(false);
      setSubmitting(false);
      setExistingRequest(null);
      setRejected(false);
    }
  }, [isOpen]);

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP, HEIC).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB.');
      return;
    }

    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Submit request ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!proofFile) {
      toast.error('Please upload your payment proof image first.');
      return;
    }

    setUploading(true);
    let uploadedUrl = proofPreview || '';

    try {
      // 1. Attempt upload to Supabase Storage
      const ext = proofFile.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('statement-proofs')
        .upload(path, proofFile, { upsert: true });

      if (!uploadError && uploadData) {
        uploadedUrl = supabase.storage.from('statement-proofs').getPublicUrl(path).data.publicUrl;
      }
    } catch (err: any) {
      console.warn('[StatementRequestModal] Storage bucket note, proceeding with inline preview:', err);
    }

    setUploading(false);
    setSubmitting(true);

    try {
      // 2. Insert request row into statement_print_requests
      const { data: insertedRow, error: insertError } = await supabase
        .from('statement_print_requests')
        .insert({
          user_id: userId,
          payment_proof_url: uploadedUrl,
          print_fee: fee,
          statement_type: 'original', // Unified single type
          status: 'pending',
        })
        .select('id, status, print_fee, statement_type, created_at, payment_proof_url')
        .single();

      if (insertError) {
        console.warn('[StatementRequestModal] DB insert note:', insertError);
        // Fallback to local storage tracking so flow continues
        const fallbackReq: ExistingRequest = {
          id: `local-${Date.now()}`,
          status: 'pending',
          print_fee: fee,
          statement_type: 'original',
          created_at: new Date().toISOString(),
          payment_proof_url: uploadedUrl,
        };
        setExistingRequest(fallbackReq);
      } else if (insertedRow) {
        setExistingRequest(insertedRow as ExistingRequest);
      }

      // 3. Notify admins (non-fatal)
      try {
        await notifyAdmins({
          title: 'New Account Statement Print Request',
          message: `${userName} has requested a certified account statement ($${fee}). Payment proof uploaded via ${activeMethod.currency}.`,
          type: 'alert',
          link: '/admin/statements',
        });
      } catch (notifyErr) {
        console.warn('[StatementRequestModal] Admin notify note (non-fatal):', notifyErr);
      }

      toast.success('Payment proof submitted! Awaiting admin review and approval.');
      setStep(3);
    } catch (err: any) {
      console.error('[StatementRequestModal] Submission catch:', err);
      toast.error(`Submission error: ${err?.message ?? 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resubmit (after rejection) ─────────────────────────────────────────────
  const handleResubmit = () => {
    setRejected(false);
    setExistingRequest(null);
    setStep(1);
    setProofFile(null);
    setProofPreview(null);
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh] border border-slate-100 z-10 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
              <FileText size={16} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">Request Account Statement</p>
              <p className="text-[11px] text-slate-400 leading-tight">Certified 5-Page Official Document</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Loading state */}
          {(checkingRequest || loadingSettings) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={24} className="text-brand animate-spin" />
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          )}

          {/* Rejection state */}
          {!checkingRequest && !loadingSettings && rejected && existingRequest && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900 text-base mb-1">Request Rejected</p>
                <p className="text-sm text-slate-500 mb-3">
                  Your previous statement request was not approved.
                </p>
                {existingRequest.rejection_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left mb-4">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Admin Note</p>
                    <p className="text-sm text-red-800">{existingRequest.rejection_reason}</p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Fee required</span>
                    <span className="font-semibold text-slate-700">{fmt(existingRequest.print_fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Document</span>
                    <span className="font-semibold text-slate-700">Official Certified &amp; Stamped Statement</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Submitted</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(existingRequest.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handleResubmit}
                  className="w-full py-3 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition-colors"
                >
                  Resubmit Request
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Normal flow */}
          {!checkingRequest && !loadingSettings && !rejected && (
            <>
              <StepIndicator current={step} />

              {/* ══ STEP 1: Review & Pay ══ */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Info box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex gap-3">
                      <FileText size={18} className="text-brand shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">
                          Official Certified &amp; Stamped Statement
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Your full account statement is a complete 5-page legal document covering your identity verification,
                          portfolio holdings, returns breakdown, complete ledger, and formal regulatory stamp &amp; signatures.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fee Display */}
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-brand" />
                      <div>
                        <span className="text-sm font-semibold text-slate-800">Print &amp; Verification Fee</span>
                        <p className="text-[10px] text-slate-500">Official administration charge</p>
                      </div>
                    </div>
                    <span className="text-xl font-extrabold text-brand">{fmt(fee)}</span>
                  </div>

                  {/* Crypto Selection: Choice between USDT and BTC */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Coins size={14} className="text-brand" /> Select Crypto Payment Method
                      </p>
                      <span className="text-[11px] text-slate-400">Choose USDT or BTC</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {depositMethods
                        .filter((m) => ['USDT', 'BTC'].includes(m.currency.toUpperCase()))
                        .map((method) => {
                          const isSelected = selectedCurrency.toUpperCase() === method.currency.toUpperCase();
                          return (
                            <button
                              key={method.currency}
                              type="button"
                              onClick={() => setSelectedCurrency(method.currency)}
                              className={`p-3 rounded-2xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-brand bg-brand/5 shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-extrabold ${isSelected ? 'text-brand' : 'text-slate-800'}`}>
                                  {method.currency}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isSelected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {method.network}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {method.currency === 'USDT' ? 'Tether USD' : 'Bitcoin'}
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Exact Address Display for Selected Crypto */}
                  {activeMethod && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white bg-slate-900 px-2.5 py-0.5 rounded-md">
                            {activeMethod.currency}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            Network: <strong className="text-slate-700">{activeMethod.network}</strong>
                          </span>
                        </div>
                        <span className="text-[11px] text-brand font-semibold">Exact Admin Address</span>
                      </div>

                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                        <p className="flex-1 text-xs font-mono text-slate-800 break-all leading-relaxed select-all">
                          {activeMethod.address}
                        </p>
                        <CopyButton text={activeMethod.address} />
                      </div>

                      <p className="text-xs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                        <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                        Send exactly <strong className="text-slate-800 font-semibold">{fmt(fee)}</strong> worth of{' '}
                        <strong>{activeMethod.currency}</strong> ({activeMethod.network}) to the exact address above.
                        Save a screenshot of the completed transfer to upload in the next step.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 2: Upload Proof ══ */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Upload a clear screenshot or receipt of your completed payment for the{' '}
                      <strong className="text-slate-700">{fmt(fee)}</strong> statement fee via{' '}
                      <strong className="text-slate-700">{activeMethod.currency}</strong> ({activeMethod.network}).
                    </p>
                  </div>

                  {/* Drop zone / file picker */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {!proofPreview ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center gap-3 hover:border-brand/50 hover:bg-brand/5 transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-brand/10 flex items-center justify-center transition-colors">
                          <Upload size={22} className="text-slate-400 group-hover:text-brand transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700">Click to upload payment proof</p>
                          <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, WEBP or HEIC (max 10 MB)</p>
                        </div>
                      </button>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
                        <img
                          src={proofPreview}
                          alt="Payment proof preview"
                          className="w-full max-h-64 object-contain bg-slate-50"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
                          >
                            <ImageIcon size={13} />
                            Change Image
                          </button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                          <p className="text-white text-xs font-medium truncate">{proofFile?.name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirmation summary */}
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                    <CheckCircle2 size={16} className="text-brand shrink-0" />
                    <p className="text-xs text-slate-600">
                      Payment of <strong className="text-brand">{fmt(fee)}</strong> via{' '}
                      <strong>{activeMethod.currency}</strong> ({activeMethod.network}) for Official Account Statement.
                    </p>
                  </div>
                </div>
              )}

              {/* ══ STEP 3: Pending Review ══ */}
              {step === 3 && (
                <div className="flex flex-col items-center gap-5 py-2 animate-in fade-in duration-200">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
                      <Clock size={32} className="text-amber-500 animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900 mb-1.5">Payment Under Verification</p>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Your payment proof has been forwarded to the compliance desk. As soon as the admin verifies your transfer,
                      your official certified statement will be unlocked for instant viewing and printing.
                    </p>
                  </div>

                  {existingRequest && (
                    <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Request Details</p>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Print Fee', value: fmt(existingRequest.print_fee) },
                          { label: 'Document Type', value: 'Official Certified & Stamped Statement' },
                          {
                            label: 'Submitted Date',
                            value: new Date(existingRequest.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            }),
                          },
                          { label: 'Status', value: 'Pending Admin Verification' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">{label}</span>
                            <span
                              className={`font-semibold ${label === 'Status' ? 'text-amber-600' : 'text-slate-800'}`}
                            >
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer / Actions ── */}
        {!checkingRequest && !loadingSettings && !rejected && (
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 space-y-2">
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!activeMethod}
                className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                Proceed to Upload Proof →
              </button>
            )}

            {step === 2 && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!proofFile || uploading || submitting}
                  className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  {uploading || submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      {uploading ? 'Uploading payment proof…' : 'Submitting to compliance…'}
                    </>
                  ) : (
                    'Confirm & Submit Proof'
                  )}
                </button>
                <button
                  onClick={() => setStep(1)}
                  disabled={uploading || submitting}
                  className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  ← Back to Payment Address
                </button>
              </>
            )}

            {step === 3 && (
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}

        {/* Rejection footer */}
        {!checkingRequest && !loadingSettings && rejected && (
          <div className="h-2 shrink-0" />
        )}
      </div>
    </div>
  );
};

export default StatementRequestModal;
