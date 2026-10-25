import React, { useState } from 'react';
import { 
  Building2, Car, ExternalLink, CheckCircle, Clock, 
  Briefcase, Plus, FileText
} from 'lucide-react';
import type { CustomPropertyRequest, PropertyInvestment } from '../../types/property';
import { TitleDeedCertificateModal } from './TitleDeedCertificateModal';
import { useAuthStore } from '../../store/authStore';

interface MyPropertiesSectionProps {
  investments: PropertyInvestment[];
  customRequests: CustomPropertyRequest[];
  onRequestCustom: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const MyPropertiesSection: React.FC<MyPropertiesSectionProps> = ({
  investments,
  customRequests,
  onRequestCustom,
}) => {
  const { profile } = useAuthStore();
  const [activeSubTab, setActiveSubTab] = useState<'deeds' | 'escrow'>('deeds');
  const [selectedInvestmentForDeed, setSelectedInvestmentForDeed] = useState<PropertyInvestment | null>(null);

  if (investments.length === 0 && customRequests.length === 0) {
    return null;
  }

  return (
    <>
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* ── SECTION HEADER & TABS ────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('deeds')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              activeSubTab === 'deeds'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 size={13} />
            <span>My Active Deeds</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeSubTab === 'deeds' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {investments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('escrow')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              activeSubTab === 'escrow'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Briefcase size={13} />
            <span>Assisted Escrow Orders</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeSubTab === 'escrow' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {customRequests.length}
            </span>
          </button>
        </div>

        <button
          onClick={onRequestCustom}
          className="text-xs font-bold text-brand hover:text-brand-dark flex items-center gap-1 transition"
        >
          <Plus size={13} />
          <span>New Escrow Acquisition</span>
        </button>
      </div>

      {/* ── TAB 1: ACTIVE DEEDS ─────────────────────────────────────────── */}
      {activeSubTab === 'deeds' && (
        <div>
          {investments.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-slate-400">
              No fractional property or vehicle deeds in your portfolio yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="px-5 py-3">Asset Title</th>
                    <th className="px-4 py-3">Paid to Date</th>
                    <th className="px-4 py-3">Remaining Balance</th>
                    <th className="px-4 py-3">Amortization</th>
                    <th className="px-4 py-3">Monthly Payment</th>
                    <th className="px-4 py-3">Conveyance Status</th>
                    <th className="px-4 py-3 text-right">Legal Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {investments.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {inv.property?.title || 'Tokenized Asset'}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-700 font-bold tabular-nums">
                        {fmt(inv.amount_paid)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 tabular-nums">
                        {fmt(inv.remaining_balance)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {inv.term_months ? `${inv.term_months} Months` : '12 Months'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-indigo-700 tabular-nums">
                        {fmt(inv.monthly_payment || 0)}/mo
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                          inv.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {inv.status === 'active' ? <CheckCircle size={10} /> : <Clock size={10} />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedInvestmentForDeed(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition shadow-2xs"
                        >
                          <FileText size={12} className="text-brand" />
                          <span>Title Deed</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ASSISTED ESCROW ORDERS ──────────────────────────────── */}
      {activeSubTab === 'escrow' && (
        <div>
          {customRequests.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-slate-400">
              No assisted acquisition requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="px-5 py-3">Asset Type & Source</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">20% Deposit</th>
                    <th className="px-4 py-3">Term</th>
                    <th className="px-4 py-3">Est. Monthly</th>
                    <th className="px-4 py-3">Escrow Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {customRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        {req.category === 'Car' ? (
                          <Car size={14} className="text-indigo-600 shrink-0" />
                        ) : (
                          <Building2 size={14} className="text-brand shrink-0" />
                        )}
                        <span>{req.category}</span>
                        <a
                          href={req.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline inline-flex items-center gap-0.5 font-normal text-[11px]"
                          title="View listing link"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 truncate max-w-[160px]">
                        {req.location}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 tabular-nums">
                        {fmt(req.total_price)}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-700 font-bold tabular-nums">
                        {fmt(req.upfront_deposit)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {req.term_months} Mos
                      </td>
                      <td className="px-4 py-3.5 font-bold text-indigo-700 tabular-nums">
                        {fmt(req.monthly_payment)}/mo
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border bg-blue-50 text-blue-700 border-blue-200">
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>

    {selectedInvestmentForDeed && (
      <TitleDeedCertificateModal
        isOpen={Boolean(selectedInvestmentForDeed)}
        onClose={() => setSelectedInvestmentForDeed(null)}
        investment={selectedInvestmentForDeed}
        investorName={profile?.name || 'Verified Investor'}
        investorEmail={profile?.email || ''}
      />
    )}
    </>
  );
};
