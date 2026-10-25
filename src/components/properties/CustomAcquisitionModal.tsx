import React, { useState } from 'react';
import { 
  X, Building2, Car, ExternalLink, ShieldCheck, Wallet, 
  TrendingUp, CheckCircle2, ArrowRight, Plus 
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CustomAcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  onSubmit: (data: {
    category: 'House' | 'Car';
    url: string;
    location: string;
    price: number;
    isResident: boolean;
    beginImmediate: boolean;
    termMonths: number;
  }) => Promise<void>;
  submitting: boolean;
  success: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const CustomAcquisitionModal: React.FC<CustomAcquisitionModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  onSubmit,
  submitting,
  success,
}) => {
  const [category, setCategory] = useState<'House' | 'Car'>('House');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [isResident, setIsResident] = useState<'yes' | 'no'>('yes');
  const [beginImmediate, setBeginImmediate] = useState<'yes' | 'no'>('yes');
  const [term, setTerm] = useState('60');

  if (!isOpen) return null;

  const numericPrice = parseFloat(price) || 0;
  const deposit20 = numericPrice * 0.20;
  const termMonths = parseInt(term) || 60;
  const remaining = Math.max(0, numericPrice - deposit20);
  const monthly = termMonths > 0 ? remaining / termMonths : 0;
  const hasSufficient = walletBalance >= deposit20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !location.trim() || numericPrice <= 0) return;
    onSubmit({
      category,
      url: url.trim(),
      location: location.trim(),
      price: numericPrice,
      isResident: isResident === 'yes',
      beginImmediate: beginImmediate === 'yes',
      termMonths,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Assisted Escrow Acquisition</h3>
              <p className="text-xs text-slate-300">RPM Corporate Desk acquires external real estate & vehicles for you</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-xl font-extrabold text-slate-900">Purchase Request Submitted!</h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Our Corporate Acquisitions & Conveyance Desk has received your order. Please complete the allocation steps below:
              </p>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 text-left space-y-3.5 text-xs text-slate-700">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="font-bold text-slate-900">Deposit 20% Upfront Down Payment</p>
                    <p className="text-slate-500 mt-0.5">Ensure your required 20% down payment ({fmt(deposit20)}) is available in your RPM Wallet.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="font-bold text-slate-900">Upload KYC Verification Documents</p>
                    <p className="text-slate-500 mt-0.5">Visit Settings &gt; KYC to upload your ID / Passport for property conveyance.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="font-bold text-slate-900">Assigned Escrow Officer</p>
                    <p className="text-slate-500 mt-0.5">An officer will direct-message you in your RPM Inbox with closing paperwork.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/app/wallet"
                  onClick={onClose}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-2xl text-center text-xs sm:text-sm shadow-md transition"
                >
                  Go to Wallet & Deposit
                </Link>
                <Link
                  to="/app/settings?tab=kyc"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-2xl text-center text-xs sm:text-sm transition"
                >
                  Upload KYC in Settings
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Asset Type Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Asset Classification
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCategory('House')}
                    className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                      category === 'House'
                        ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 size={16} /> Real Estate / Estate
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('Car')}
                    className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                      category === 'Car'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Car size={16} /> Luxury Vehicle
                  </button>
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  External Public Listing URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <ExternalLink className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={category === 'House' ? 'https://www.zillow.com/... or Realtor link' : 'https://www.autotrader.com/... or Carvana link'}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Accepts any public listing link from Zillow, Realtor, Redfin, AutoTrader, etc.</p>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location / Region <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX or Miami, FL"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Listing Price (USD) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                    required
                  />
                </div>
              </div>

              {/* 20% Calculation & Wallet Advisory */}
              {numericPrice > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-200/60">
                    <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Price</span>
                      <span className="text-xs font-bold text-slate-900">{fmt(numericPrice)}</span>
                    </div>
                    <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100 shadow-xs">
                      <span className="text-[10px] text-emerald-800 font-bold uppercase block">20% Down Target</span>
                      <span className="text-xs font-bold text-emerald-700">{fmt(deposit20)}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Est. Monthly</span>
                      <span className="text-xs font-bold text-indigo-700">{fmt(monthly)}/mo</span>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl text-xs flex flex-col gap-2.5 ${
                    hasSufficient 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-gradient-to-br from-slate-950 to-indigo-950 text-white border border-indigo-900/40 shadow-md'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-xl shrink-0 ${hasSufficient ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-amber-400'}`}>
                        <Wallet size={16} />
                      </div>
                      <div className="leading-relaxed flex-1">
                        <p className="font-bold text-xs sm:text-sm">
                          {hasSufficient ? 'Wallet Balance Sufficient for 20% Down Payment' : 'Build Towards Your 20% Down Payment'}
                        </p>
                        <p className={`mt-0.5 text-[11px] leading-relaxed ${hasSufficient ? 'text-emerald-700' : 'text-slate-300'}`}>
                          {hasSufficient
                            ? `Your wallet balance (${fmt(walletBalance)}) covers the 20% deposit (${fmt(deposit20)}). RPM is ready to initiate escrow.`
                            : `Current wallet balance is ${fmt(walletBalance)}. You can top up or stake available funds to accelerate savings.`}
                        </p>
                      </div>
                    </div>

                    {!hasSufficient && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                        <Link
                          to="/app/wallet"
                          onClick={onClose}
                          className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                        >
                          <Plus size={12} /> Top Up Wallet
                        </Link>
                        <Link
                          to="/app/staking"
                          onClick={onClose}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                        >
                          <TrendingUp size={12} /> Stake Funds
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Residency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Are you a national / permanent resident of the purchase region?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsResident('yes')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      isResident === 'yes'
                        ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Yes (National / Resident)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsResident('no')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      isResident === 'no'
                        ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    No (Foreign / Non-Resident)
                  </button>
                </div>
              </div>

              {/* Immediate documentation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Begin legal documentation & title deed conveyance immediately?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBeginImmediate('yes')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      beginImmediate === 'yes'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Yes, Begin Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setBeginImmediate('no')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      beginImmediate === 'no'
                        ? 'bg-slate-100 border-slate-400 text-slate-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    No, Pre-Approval Review
                  </button>
                </div>
              </div>

              {/* Financing Span */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Financing Time Span (Max 5 Years)
                </label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="12">1 Year (12 Months)</option>
                  <option value="24">2 Years (24 Months)</option>
                  <option value="36">3 Years (36 Months)</option>
                  <option value="48">4 Years (48 Months)</option>
                  <option value="60">5 Years (60 Months - Maximum)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-5 rounded-2xl bg-brand hover:bg-brand-dark text-white font-extrabold text-xs sm:text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Submitting Order...' : 'Submit Escrow Request'}
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
