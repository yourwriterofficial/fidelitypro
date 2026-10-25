import React, { useRef } from 'react';
import { 
  X, Printer, ShieldCheck 
} from 'lucide-react';
import type { PropertyInvestment, Property } from '../../types/property';

interface TitleDeedCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment?: PropertyInvestment | null;
  property?: Property | null;
  investorName: string;
  investorEmail: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const TitleDeedCertificateModal: React.FC<TitleDeedCertificateModalProps> = ({
  isOpen,
  onClose,
  investment,
  property,
  investorName,
  investorEmail,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const assetTitle = property?.title || investment?.property?.title || 'Tokenized Institutional Asset';
  const assetLocation = property?.location || 'Verified Municipal Recording';
  const assetCategory = property?.category || 'Real Estate';
  const totalValuation = property?.price || (investment ? investment.amount_paid + investment.remaining_balance : 0);
  const downPaymentPaid = investment?.amount_paid || (property ? property.price * (property.down_payment_percent / 100) : 0);
  const remainingBalance = investment?.remaining_balance || Math.max(0, totalValuation - downPaymentPaid);
  const termMonths = investment?.term_months || property?.term_months || 24;
  const monthlyPayment = investment?.monthly_payment || (termMonths > 0 ? remainingBalance / termMonths : 0);
  const executionDate = investment?.created_at 
    ? new Date(investment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const certId = `RPM-DEED-${(investment?.id || property?.id || '2026').slice(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Actions */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Official Title Deed Document</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
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

        {/* ── PRINTABLE CERTIFICATE CANVAS ───────────────────────────────── */}
        <div 
          ref={printRef}
          className="p-6 sm:p-10 overflow-y-auto flex-1 bg-gradient-to-b from-white to-slate-50/50 text-slate-900 space-y-6 print:p-0 print:space-y-4"
        >
          {/* Certificate Header & Seal */}
          <div className="border-4 border-double border-slate-900/20 p-6 sm:p-8 rounded-2xl relative bg-white shadow-xs">
            {/* Watermark / Seal */}
            <div className="absolute right-6 top-6 opacity-10 pointer-events-none">
              <ShieldCheck size={100} className="text-slate-900" />
            </div>

            <div className="text-center space-y-1 mb-6 border-b border-slate-100 pb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white font-extrabold text-base mb-2 shadow-xs">
                RPM
              </div>
              <h1 className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                RPM Global Escrow & Title Conveyance Registry
              </h1>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                CERTIFICATE OF FRACTIONAL TITLE DEED EQUITY
              </h2>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest pt-1">
                Registry Identification No: {certId}
              </p>
            </div>

            {/* Granting Clause */}
            <p className="text-xs leading-relaxed text-slate-600 mb-6 text-center max-w-xl mx-auto italic">
              "This instrument certifies that the investor registered below has executed binding down payment allocation and holds fractional title deed equity and conveyance rights in the registered asset herein specified."
            </p>

            {/* Two-Column Specification Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
              {/* Investor Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Registered Beneficiary
                </span>
                <div>
                  <p className="font-extrabold text-sm text-slate-900">{investorName || 'Verified Investor'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{investorEmail}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex justify-between text-[11px]">
                  <span className="text-slate-500">Execution Date:</span>
                  <span className="font-bold text-slate-800">{executionDate}</span>
                </div>
              </div>

              {/* Asset Information */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Asset Title & Parcel
                </span>
                <div>
                  <p className="font-extrabold text-sm text-slate-900">{assetTitle}</p>
                  <p className="text-[11px] text-slate-500">{assetLocation}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex justify-between text-[11px]">
                  <span className="text-slate-500">Asset Type:</span>
                  <span className="font-bold text-slate-800">{assetCategory}</span>
                </div>
              </div>
            </div>

            {/* Financial Ledger Schedule */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs space-y-3 mb-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block border-b border-white/10 pb-1.5">
                Financial Schedule & Amortization
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total Valuation</span>
                  <span className="text-sm font-extrabold tabular-nums">{fmt(totalValuation)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase block">Equity Paid (Down)</span>
                  <span className="text-sm font-extrabold text-emerald-300 tabular-nums">{fmt(downPaymentPaid)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Amortization Span</span>
                  <span className="text-sm font-extrabold tabular-nums">{termMonths} Months</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase block">Monthly Installment</span>
                  <span className="text-sm font-extrabold text-indigo-200 tabular-nums">{fmt(monthlyPayment)}/mo</span>
                </div>
              </div>
            </div>

            {/* Signatures & Seal Block */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                  ✓
                </div>
                <div>
                  <p className="font-extrabold text-xs text-slate-900">Recorded & Conveyed in Trust</p>
                  <p className="text-[10px] text-slate-500">RPM Corporate Escrow Services LLC</p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="font-serif italic text-sm text-slate-800 border-b border-slate-300 pb-0.5 px-4 inline-block">
                  Alexander Vance, Esq.
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Managing Conveyance Officer
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
