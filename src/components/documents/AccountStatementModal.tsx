import React, { useRef } from 'react';
import { X, Printer, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    email: string;
    wallet_balance: number;
    kyc_status?: string;
    kyc_level?: number;
    referral_code?: string;
    can_withdraw: boolean;
    can_invest: boolean;
    can_stake: boolean;
    can_property: boolean;
    created_at: string;
  };
  transactions?: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    created_at: string;
  }>;
  investments?: Array<{
    id: string;
    product_name: string;
    amount: number;
    daily_return: number;
    duration_days: number;
    status: string;
    start_date: string;
    end_date: string;
  }>;
  stakingOrders?: Array<{
    id: string;
    amount: number;
    apy: number;
    lock_days: number;
    status: string;
    start_date: string;
    end_date: string;
  }>;
  propertyInvestments?: Array<{
    id: string;
    property_title?: string;
    amount_paid: number;
    remaining_balance: number;
    status: string;
    term_months?: number;
    monthly_payment?: number;
    property?: { title: string; price: number };
  }>;
  statementRef?: string;
  statementType?: 'original' | 'stamped_copy';
  printFeePaid?: number;
  adminApprovedAt?: string;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n);

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const daysElapsed = (startIso: string): number => {
  const start = new Date(startIso);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
};

const txTypeLabel: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  investment: 'ROI Plan',
  return: 'Daily Yield',
  admin: 'Admin Credit',
  property: 'Property Equity',
  staking: 'Staking',
};

const statusColor: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  active: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  verified: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-violet-100 text-violet-700',
};

const getStatusClass = (s: string) =>
  statusColor[s?.toLowerCase()] ?? 'bg-slate-100 text-slate-600';

/* ─────────────────────────────────────────────
   Shared sub-components
───────────────────────────────────────────── */

/** Rotated circular watermark stamp in each page */
const Stamp = ({ label = 'ORIGINAL' }: { label?: string }) => (
  <div
    className="border-2 border-green-600 rounded-full w-24 h-24 flex items-center justify-center
      text-center text-green-600 text-[8px] font-black uppercase tracking-wide
      rotate-[-12deg] opacity-20 absolute top-4 right-4 pointer-events-none select-none z-0"
    aria-hidden
  >
    <span className="leading-tight px-1">{label}</span>
  </div>
);

/** Shared page header bar */
const PageHeader = ({
  page,
  statementRef,
  statementType,
}: {
  page: number;
  statementRef: string;
  statementType: string;
}) => (
  <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between rounded-t-lg print:rounded-none">
    {/* Left branding */}
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-[#00674F] rounded-lg flex items-center justify-center shrink-0">
        <span className="text-white font-extrabold text-base">R</span>
      </div>
      <div>
        <p className="font-extrabold text-sm tracking-tight leading-none">RPM Global Investment Platform</p>
        <p className="text-slate-400 text-[10px] mt-0.5 leading-none">Regulated · Trusted · Transparent</p>
      </div>
    </div>
    {/* Right statement info */}
    <div className="text-right">
      <p className="font-bold text-xs uppercase tracking-widest text-slate-300">Official Account Statement</p>
      <p className="text-[10px] text-slate-400 mt-0.5">
        Page {page} of 5 &nbsp;|&nbsp; Ref: <span className="text-white font-mono">{statementRef}</span>
      </p>
      <p className="text-[9px] text-slate-500 mt-0.5 capitalize">{statementType.replace('_', ' ')}</p>
    </div>
  </div>
);

/** Section title bar */
const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200">
    <span className="text-[#00674F]">{icon}</span>
    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
  </div>
);

/** Dark summary card bar */
const SummaryBar = ({ items }: { items: { label: string; value: string; accent?: boolean }[] }) => (
  <div className="bg-slate-900 rounded-lg mx-6 mb-6 p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {items.map((item) => (
      <div key={item.label} className="text-center">
        <p className={`text-base font-extrabold ${item.accent ? 'text-[#00674F]' : 'text-white'}`}>
          {item.value}
        </p>
        <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-0.5">{item.label}</p>
      </div>
    ))}
  </div>
);

/** Page wrapper with separator */
const Page = ({
  children,
  last,
}: {
  children: React.ReactNode;
  last?: boolean;
}) => (
  <div
    className={`bg-white relative overflow-hidden ${!last ? 'border-b-8 border-slate-200 mb-0' : ''} print:page-break-after`}
    style={!last ? { pageBreakAfter: 'always' } : undefined}
  >
    {children}
  </div>
);

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const AccountStatementModal: React.FC<AccountStatementModalProps> = ({
  isOpen,
  onClose,
  profile,
  transactions = [],
  investments = [],
  stakingOrders = [],
  propertyInvestments = [],
  statementRef = `RPM-STMT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  statementType = 'original',
  printFeePaid = 0,
  adminApprovedAt,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  /* ── Derived values ── */
  const accId = `RPM-ACC-${profile.id.substring(0, 8).toUpperCase()}`;
  const isKycVerified =
    profile.kyc_status?.toLowerCase() === 'verified' ||
    profile.kyc_status?.toLowerCase() === 'approved';

  const totalDeposited = transactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = Math.abs(
    transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
  );

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const completedInvestments = investments.filter((i) => i.status === 'completed').length;
  const totalReturns = investments.reduce(
    (s, i) => s + i.amount * (i.daily_return / 100) * daysElapsed(i.start_date),
    0,
  );
  const avgDaily =
    investments.length > 0
      ? investments.reduce((s, i) => s + i.daily_return, 0) / investments.length
      : 0;

  const totalPropertyPaid = propertyInvestments.reduce((s, p) => s + p.amount_paid, 0);
  const totalStaked = stakingOrders.reduce((s, st) => s + st.amount, 0);
  const avgApy =
    stakingOrders.length > 0
      ? stakingOrders.reduce((s, st) => s + st.apy, 0) / stakingOrders.length
      : 0;

  const handlePrint = () => window.print();

  /* ── Page 1 details grid ── */
  const detailItems = [
    { label: 'Full Name', value: profile.name },
    { label: 'Email Address', value: profile.email },
    { label: 'Account ID', value: accId },
    {
      label: 'KYC Status',
      value: isKycVerified
        ? '✓ Verified'
        : profile.kyc_status ?? 'Unverified',
      green: isKycVerified,
    },
    { label: 'Member Since', value: fmtDate(profile.created_at) },
    { label: 'Account Status', value: 'Active', green: true },
    {
      label: 'Wallet Balance',
      value: fmt(profile.wallet_balance),
      large: true,
      green: true,
    },
    { label: 'Referral Code', value: profile.referral_code ?? '—' },
    {
      label: 'Withdrawal Rights',
      value: profile.can_withdraw ? '✓ Enabled' : '✗ Restricted',
      green: profile.can_withdraw,
    },
    {
      label: 'Investment Rights',
      value: profile.can_invest ? '✓ Enabled' : '✗ Restricted',
      green: profile.can_invest,
    },
    {
      label: 'Staking Rights',
      value: profile.can_stake ? '✓ Enabled' : '✗ Restricted',
      green: profile.can_stake,
    },
    {
      label: 'Property Rights',
      value: profile.can_property ? '✓ Enabled' : '✗ Restricted',
      green: profile.can_property,
    },
  ];

  return (
    <>
      {/* ── Print styles injected via style tag ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #rpm-statement-printable, #rpm-statement-printable * { visibility: visible !important; }
          #rpm-statement-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:page-break-after { page-break-after: always; }
          #rpm-modal-chrome { display: none !important; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-6 px-2">
        <div className="w-full max-w-4xl flex flex-col gap-0">

          {/* ── Modal Chrome (header bar) ── */}
          <div
            id="rpm-modal-chrome"
            className="bg-slate-900 rounded-t-2xl px-5 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden"
          >
            <div className="flex items-center gap-2 text-white">
              <FileText size={16} className="text-[#00674F]" />
              <span className="font-bold text-sm">Account Statement</span>
              <span className="text-slate-400 text-xs font-mono ml-2">{statementRef}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00674F] hover:bg-[#004d3a] text-white text-xs font-semibold rounded-lg transition"
              >
                <Printer size={13} /> Print Statement
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Printable Pages ── */}
          <div id="rpm-statement-printable" ref={printRef} className="shadow-2xl">

            {/* ════════════════════════════════════════
                PAGE 1 — Cover & Account Profile
            ════════════════════════════════════════ */}
            <Page>
              <PageHeader page={1} statementRef={statementRef} statementType={statementType} />
              <Stamp />

              {/* Cover hero */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      OFFICIAL ACCOUNT STATEMENT
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Certified Copy — Issued upon Verified Request
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                        Ref: {statementRef}
                      </span>
                      <span className="text-xs text-slate-400">
                        Issued: {fmtDateTime(new Date().toISOString())}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ShieldCheck size={32} className="text-[#00674F]" />
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Certified</span>
                  </div>
                </div>
              </div>

              <SectionTitle icon={<ShieldCheck size={14} />} title="Account Holder Details" />

              {/* Details grid */}
              <div className="px-6 py-4 grid grid-cols-3 gap-4">
                {detailItems.map((item) => (
                  <div
                    key={item.label}
                    className="border border-slate-100 rounded-lg p-3 bg-white"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      {item.label}
                    </p>
                    <p
                      className={`font-bold break-all ${
                        (item as { large?: boolean }).large
                          ? 'text-lg text-[#00674F]'
                          : (item as { green?: boolean }).green
                          ? 'text-sm text-[#00674F]'
                          : 'text-sm text-slate-800'
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Print fee bar */}
              <div className="mx-6 mb-6 bg-[#00674F] rounded-lg px-5 py-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-semibold">Statement Processing Fee Paid</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-sm">{fmt(printFeePaid)}</span>
                  {adminApprovedAt && (
                    <span className="text-[10px] text-green-200">
                      Approved: {fmtDate(adminApprovedAt)}
                    </span>
                  )}
                </div>
              </div>
            </Page>

            {/* ════════════════════════════════════════
                PAGE 2 — Wallet & Transaction Ledger
            ════════════════════════════════════════ */}
            <Page>
              <PageHeader page={2} statementRef={statementRef} statementType={statementType} />
              <Stamp />

              <SectionTitle icon={<FileText size={14} />} title="Wallet & Transaction Ledger" />

              <div className="px-6 py-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Date</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Type</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Description</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Status</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 20).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                            No transactions recorded.
                          </td>
                        </tr>
                      ) : (
                        transactions.slice(0, 20).map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">
                              {fmtDate(tx.created_at)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-700">
                              {txTypeLabel[tx.type] ?? tx.type}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 max-w-[180px] truncate">
                              {tx.description}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClass(tx.status)}`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td
                              className={`border border-slate-200 px-3 py-2 text-right font-bold ${
                                tx.amount >= 0 ? 'text-[#00674F]' : 'text-slate-400'
                              }`}
                            >
                              {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {transactions.length > 20 && (
                  <p className="text-[9px] text-slate-400 mt-1 text-right">
                    Showing 20 of {transactions.length} transactions.
                  </p>
                )}
              </div>

              <SummaryBar
                items={[
                  { label: 'Current Balance', value: fmt(profile.wallet_balance), accent: true },
                  { label: 'Total Deposited', value: fmt(totalDeposited) },
                  { label: 'Total Withdrawn', value: fmt(totalWithdrawn) },
                  {
                    label: 'Net Position',
                    value: fmt(totalDeposited - totalWithdrawn),
                    accent: totalDeposited >= totalWithdrawn,
                  },
                ]}
              />
            </Page>

            {/* ════════════════════════════════════════
                PAGE 3 — Investment Portfolio
            ════════════════════════════════════════ */}
            <Page>
              <PageHeader page={3} statementRef={statementRef} statementType={statementType} />
              <Stamp />

              <SectionTitle icon={<FileText size={14} />} title="Investment Portfolio" />

              <div className="px-6 py-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Plan Name</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Amount</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Duration</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Daily %</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Start Date</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Status</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Returns Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                            No investment records found.
                          </td>
                        </tr>
                      ) : (
                        investments.map((inv) => {
                          const elapsed = daysElapsed(inv.start_date);
                          const returns = inv.amount * (inv.daily_return / 100) * elapsed;
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">
                                {inv.product_name}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-right text-slate-700">
                                {fmt(inv.amount)}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">
                                {inv.duration_days}d
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-[#00674F]">
                                {inv.daily_return}%
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">
                                {fmtDate(inv.start_date)}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClass(inv.status)}`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-right font-bold text-[#00674F]">
                                {fmt(returns)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <SummaryBar
                items={[
                  { label: 'Active Invested', value: fmt(totalInvested), accent: true },
                  { label: 'Completed Plans', value: `${completedInvestments}` },
                  { label: 'Total Returns', value: fmt(totalReturns), accent: true },
                  { label: 'Avg Daily %', value: `${avgDaily.toFixed(2)}%` },
                ]}
              />
            </Page>

            {/* ════════════════════════════════════════
                PAGE 4 — Property & Staking Holdings
            ════════════════════════════════════════ */}
            <Page>
              <PageHeader page={4} statementRef={statementRef} statementType={statementType} />
              <Stamp />

              {/* Property table */}
              <SectionTitle icon={<FileText size={14} />} title="Property Equity Holdings" />
              <div className="px-6 py-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Property</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Paid</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Remaining</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Term</th>
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Monthly Pmt</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propertyInvestments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                            No property equity holdings found.
                          </td>
                        </tr>
                      ) : (
                        propertyInvestments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">
                              {p.property?.title ?? p.property_title ?? '—'}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-right text-[#00674F] font-bold">
                              {fmt(p.amount_paid)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-right text-slate-600">
                              {fmt(p.remaining_balance)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">
                              {p.term_months ? `${p.term_months}mo` : '—'}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-right text-slate-600">
                              {p.monthly_payment ? fmt(p.monthly_payment) : '—'}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClass(p.status)}`}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staking table */}
              <SectionTitle icon={<FileText size={14} />} title="Staking Positions" />
              <div className="px-6 py-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                        <th className="border border-slate-200 px-3 py-2 text-right font-semibold">Amount</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">APY</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Lock Days</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Start Date</th>
                        <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Est. End</th>
                        <th className="border border-slate-200 px-3 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stakingOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                            No staking positions found.
                          </td>
                        </tr>
                      ) : (
                        stakingOrders.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 text-right font-bold text-[#00674F]">
                              {fmt(st.amount)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-violet-600">
                              {st.apy}%
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">
                              {st.lock_days}d
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">
                              {fmtDate(st.start_date)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">
                              {fmtDate(st.end_date)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClass(st.status)}`}
                              >
                                {st.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <SummaryBar
                items={[
                  { label: 'Property Equity Paid', value: fmt(totalPropertyPaid), accent: true },
                  { label: 'Properties', value: `${propertyInvestments.length}` },
                  { label: 'Staking Locked', value: fmt(totalStaked), accent: true },
                  { label: 'Avg Staking APY', value: `${avgApy.toFixed(1)}%` },
                ]}
              />
            </Page>

            {/* ════════════════════════════════════════
                PAGE 5 — Certification & Signatures
            ════════════════════════════════════════ */}
            <Page last>
              <PageHeader page={5} statementRef={statementRef} statementType={statementType} />
              <Stamp label="CERTIFIED" />

              <SectionTitle icon={<ShieldCheck size={14} />} title="Certification & Legal Declaration" />

              {/* Certification paragraph */}
              <div className="px-6 py-5 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed border-l-4 border-[#00674F] pl-4 italic">
                  This Official Account Statement has been prepared and issued by RPM Global Investment
                  Platform in accordance with its regulatory obligations and internal compliance framework.
                  The information contained herein is certified to be true, accurate, and complete as of
                  the date of issuance, reflecting all recorded account activity, portfolio holdings, and
                  financial positions maintained within the RPM platform infrastructure.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This document is issued upon verified request, following satisfactory completion of the
                  applicable identity and authorization checks, and upon receipt of the requisite statement
                  processing fee. The statement is intended solely for the named account holder and
                  authorised third parties, and may not be reproduced, altered, or redistributed without
                  the express written consent of RPM Global Investment Platform and its legal counsel.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  RPM Global Investment Platform operates under its internal governance charter. All
                  investments, yields, and balances reflected in this statement are subject to the Terms &
                  Conditions, Risk Disclosure, and applicable laws. Past performance is not indicative of
                  future results. This statement does not constitute financial advice.
                </p>

                <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-0.5">
                  <p><strong>Statement Reference:</strong> {statementRef}</p>
                  <p><strong>Account Holder:</strong> {profile.name} ({profile.email})</p>
                  <p><strong>Account ID:</strong> {accId}</p>
                  <p><strong>Statement Date:</strong> {fmtDateTime(new Date().toISOString())}</p>
                  {adminApprovedAt && (
                    <p><strong>Admin Approved:</strong> {fmtDateTime(adminApprovedAt)}</p>
                  )}
                  <p><strong>Statement Type:</strong> {statementType === 'stamped_copy' ? 'Stamped Copy' : 'Original'}</p>
                </div>
              </div>

              {/* Signature lines */}
              <div className="px-6 pb-6">
                <div className="grid grid-cols-3 gap-6 mt-2">
                  {[
                    {
                      name: 'Alexander Vance, Esq.',
                      title: 'Senior Disbursement Counsel',
                      org: 'RPM Legal',
                    },
                    {
                      name: 'Chief Compliance Officer',
                      title: 'Head of Compliance',
                      org: 'RPM Global',
                    },
                    {
                      name: 'Head of Operations',
                      title: 'Operations & Settlement',
                      org: 'RPM Escrow & Settlement',
                    },
                  ].map((sig) => (
                    <div key={sig.name} className="flex flex-col items-center text-center">
                      {/* Signature line */}
                      <div className="w-full border-b-2 border-slate-800 mb-2 h-10 relative">
                        {/* decorative cursive-ish underline hint */}
                        <div className="absolute bottom-1 left-2 right-2 h-px bg-slate-300 opacity-50" />
                      </div>
                      <p className="text-[10px] font-extrabold text-slate-800">{sig.name}</p>
                      <p className="text-[9px] text-slate-500">{sig.title}</p>
                      <p className="text-[9px] text-[#00674F] font-semibold">{sig.org}</p>
                    </div>
                  ))}
                </div>

                {/* Stamp badges */}
                <div className="flex flex-wrap items-center gap-3 mt-6 justify-center">
                  {[
                    { label: '☑ ORIGINAL' },
                    { label: 'NOTARY STAMP' },
                    { label: 'COMPLIANCE' },
                    { label: 'RPM LEGAL' },
                  ].map((badge) => (
                    <div
                      key={badge.label}
                      className="border-2 border-[#00674F] rounded-full px-4 py-1.5 text-[#00674F] text-[10px]
                        font-extrabold uppercase tracking-widest"
                    >
                      {badge.label}
                    </div>
                  ))}
                </div>

                {/* Footer info bar */}
                <div className="mt-6 bg-slate-900 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-white">
                    <CheckCircle2 size={13} className="text-[#00674F]" />
                    <span className="font-semibold">Processing Fee Paid:</span>
                    <span className="font-extrabold text-[#00674F]">{fmt(printFeePaid)}</span>
                  </div>
                  {adminApprovedAt && (
                    <div className="text-slate-400 text-[10px]">
                      Admin Approved: <span className="text-white">{fmtDate(adminApprovedAt)}</span>
                    </div>
                  )}
                  <div className="text-slate-400 text-[10px]">
                    Type:{' '}
                    <span className="text-white uppercase font-semibold">
                      {statementType === 'stamped_copy' ? 'Stamped Copy' : 'Original'}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[9px]">
                    © {new Date().getFullYear()} RPM Global Investment Platform. All rights reserved.
                  </div>
                </div>
              </div>
            </Page>

          </div>{/* /rpm-statement-printable */}
        </div>
      </div>
    </>
  );
};

export { AccountStatementModal };
export default AccountStatementModal;
