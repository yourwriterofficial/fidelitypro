import React from 'react';
import { X, Printer, ShieldCheck, FileText } from 'lucide-react';

interface PayoutReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName?: string;
  recipientRef?: string;
  amount?: number;
  transactionRef?: string;
  date?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const formatDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const PayoutReceiptModal: React.FC<PayoutReceiptModalProps> = ({
  isOpen,
  onClose,
  recipientName = 'Wayne Bobo',
  recipientRef = 'RPM-ACC-WBOBO-2026',
  amount = 78958.0,
  transactionRef = 'RPM-TXN-7729341-EFT',
  date,
}) => {
  if (!isOpen) return null;

  const effectiveDate = formatDate(date);
  const receiptNo = 'RPM-RECV-2026-004471';
  const formattedAmount = fmt(amount);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Shell */}
      <div className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-200">

        {/* ── Dark Header Bar ─────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Confidential Legal Notice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── PRINTABLE LETTER CANVAS ──────────────────────────────── */}
        <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-gradient-to-b from-white to-slate-50/50 text-slate-900 space-y-6 print:p-0 print:space-y-4">

          {/* Letter Frame */}
          <div className="border border-slate-200 rounded-2xl relative bg-white shadow-xs overflow-hidden">

            {/* Letterhead Top Stripe */}
            <div className="bg-brand px-7 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-extrabold text-sm leading-tight">McMahon &amp; Associates</p>
                  <p className="text-white/75 text-[11px] font-medium">Attorneys at Law</p>
                </div>
              </div>
              {/* Watermark seal (top-right) */}
              <div className="opacity-20 pointer-events-none shrink-0">
                <ShieldCheck size={52} className="text-white" />
              </div>
            </div>

            {/* Letterhead Detail Bar */}
            <div className="bg-slate-900 px-7 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="text-[10px] text-slate-400 font-mono">Dean McMahon, Esq. · Independent Legal Counsel</span>
              <span className="text-[10px] text-slate-400 font-mono">88 Wall Street, Suite 600, New York, NY 10005</span>
              <span className="text-[10px] text-slate-400 font-mono">Tel: +1 (212) 555-0344</span>
              <span className="text-[10px] text-slate-400 font-mono">dmcmahon@mcmahonlaw.io</span>
            </div>

            {/* Letter Body */}
            <div className="px-7 py-7 space-y-5">

              {/* Date + Receipt Number */}
              <div className="flex flex-wrap items-start justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Date of Issue</span>
                  <p className="text-xs font-semibold text-slate-800">{effectiveDate}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Receipt No.</span>
                  <p className="text-xs font-mono font-bold text-slate-800">{receiptNo}</p>
                </div>
              </div>

              {/* To / RE */}
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider w-6 shrink-0">TO:</span>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Mr. {recipientName}</p>
                    <p className="text-[11px] font-mono text-slate-500">{recipientRef}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider w-6 shrink-0">RE:</span>
                  <p className="text-xs font-semibold text-slate-800">
                    Release of Funds — Confirmed Receipt Following Submission of RPM Account Statement
                  </p>
                </div>
              </div>

              {/* Salutation */}
              <p className="text-xs text-slate-700">Dear Mr. {recipientName},</p>

              {/* Body Paragraphs */}
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  I write in my capacity as your independent disbursement counsel to formally confirm and document the successful
                  completion of the fund release process in respect of the above-referenced matter.
                </p>
                <p>
                  As you will recall, this office issued a prior instruction requiring you, as a condition precedent to disbursement,
                  to obtain and submit a certified and verified Account Statement from{' '}
                  <strong className="text-slate-900">RPM Global Investment Platform</strong> bearing your account reference and
                  current standing. You have fully complied with that instruction.
                </p>
                <p>
                  Upon receipt of the said certified Account Statement and following our internal verification procedures, this
                  office has <strong className="text-slate-900">successfully released and disbursed</strong> the held funds in
                  their entirety. The gross disbursement of{' '}
                  <strong className="text-slate-900">{formattedAmount} USD</strong> has been confirmed as delivered to you in
                  full. There are <strong className="text-slate-900">no further outstanding conditions, holds, or requirements</strong>{' '}
                  associated with this matter.
                </p>
                <p>
                  This letter constitutes official confirmation of disbursement and should be retained for your records. Should
                  any institution require verification of this release, this document may be presented in conjunction with your
                  RPM Account Statement.
                </p>
              </div>

              {/* Settlement Schedule Dark Box */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block border-b border-white/10 pb-2">
                  Disbursement Settlement Schedule
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[11px]">
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Payee</span>
                    <span className="font-extrabold text-white">Mr. {recipientName}</span>
                  </div>
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Account Reference</span>
                    <span className="font-mono font-bold text-white">{recipientRef}</span>
                  </div>
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Gross Amount</span>
                    <span className="font-extrabold text-emerald-300 tabular-nums">{formattedAmount}</span>
                  </div>
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Net Disbursed</span>
                    <span className="font-extrabold text-emerald-300 tabular-nums">{formattedAmount}</span>
                  </div>
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Effective Date</span>
                    <span className="font-bold text-white">{effectiveDate}</span>
                  </div>
                  <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                    <span className="text-slate-400 uppercase font-semibold text-[10px]">Transaction Reference</span>
                    <span className="font-mono font-bold text-white">{transactionRef}</span>
                  </div>
                </div>
                {/* Status Banner */}
                <div className="mt-1 flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl py-2">
                  <span className="text-emerald-300 text-sm font-black tracking-wide">✓ SUCCESSFULLY DELIVERED</span>
                </div>
              </div>

              {/* Closing */}
              <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                <p>
                  Please retain this document alongside your RPM Global Account Statement as part of your permanent financial
                  records. This receipt has been issued by this office and bears the full authority of McMahon &amp; Associates,
                  Attorneys at Law.
                </p>
                <p>Yours faithfully,</p>
              </div>

              {/* Signature Block */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand border border-brand/20 flex items-center justify-center font-extrabold text-sm shrink-0">
                    ✓
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-slate-900">Certified &amp; Sealed</p>
                    <p className="text-[10px] text-slate-500">McMahon &amp; Associates, Attorneys at Law</p>
                    <p className="text-[10px] text-slate-500">88 Wall Street, Suite 600, New York, NY 10005</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif italic text-sm text-slate-800 border-b border-slate-400 pb-0.5 px-4 inline-block">
                    Dean McMahon
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Dean McMahon, Esq.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Independent Disbursement Counsel
                  </p>
                </div>
              </div>

              {/* Footer Disclaimer */}
              <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-4 leading-relaxed">
                This communication is intended solely for the named recipient and constitutes a privileged and confidential
                legal document. Unauthorised review, use, disclosure, or distribution is strictly prohibited. If you have
                received this document in error, please notify this office immediately and destroy all copies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
