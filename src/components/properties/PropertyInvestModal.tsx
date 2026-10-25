import React, { useState } from 'react';
import { 
  X, Building2, MapPin, Heart, ExternalLink, 
  Wallet, ShieldCheck, Bed, Bath, Maximize2, Car as CarIcon, 
  Calendar, Gauge, Cog, Fuel, CheckCircle, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Property } from '../../types/property';
import { PropertyImageCarousel } from './PropertyImageCarousel';

interface PropertyInvestModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  scrollSpeed: number;
  walletBalance: number;
  isLiked: boolean;
  isLiking: boolean;
  onLike: (e: React.MouseEvent, id: string) => void;
  onSubmitInvest: (amount: number, termMonths: number) => Promise<void>;
  submitting: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const PropertyInvestModal: React.FC<PropertyInvestModalProps> = ({
  property,
  isOpen,
  onClose,
  scrollSpeed,
  walletBalance,
  isLiked,
  isLiking,
  onLike,
  onSubmitInvest,
  submitting,
}) => {
  const isSold = property.status === 'sold';
  const isCar = property.category === 'Car';
  const minRequiredDown = property.price * (property.down_payment_percent / 100);

  const [paymentAmount, setPaymentAmount] = useState<string>(minRequiredDown.toString());
  const [selectedTerm, setSelectedTerm] = useState<string>('24');

  if (!isOpen) return null;

  const numericPayment = parseFloat(paymentAmount) || 0;
  const remainingBalance = Math.max(0, property.price - numericPayment);
  const termMonthsVal = parseInt(selectedTerm) || 24;
  const calculatedMonthly = remainingBalance > 0 ? remainingBalance / termMonthsVal : 0;
  const hasSufficientWallet = walletBalance >= numericPayment;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericPayment <= 0) return;
    onSubmitInvest(numericPayment, termMonthsVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* ── MODAL HEADER ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white">
                {isCar ? 'Luxury Vehicle' : 'Tokenized Real Estate'}
              </span>
              {isSold && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500 text-white">
                  Sold Out
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">{property.title}</h2>
            {property.location && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                <MapPin size={13} className="text-emerald-500 shrink-0" />
                <span>{property.location}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => onLike(e, property.id)}
              disabled={isLiking}
              className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                isLiked
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-rose-500 hover:border-rose-200'
              }`}
              title={isLiked ? 'Already liked' : 'Like listing'}
            >
              <Heart size={15} className={isLiked ? 'fill-current' : ''} />
              <span className="hidden sm:inline">{isLiked ? 'Liked' : 'Like'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200/60 rounded-xl transition text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── MODAL SCROLLABLE BODY ─────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {/* Gallery Media */}
          {property.image_urls && property.image_urls.length > 0 ? (
            <div className="relative h-64 sm:h-72 w-full bg-slate-950 shrink-0">
              <PropertyImageCarousel
                urls={property.image_urls}
                title={property.title}
                speed={scrollSpeed}
              />
            </div>
          ) : (
            <div className="h-48 w-full bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 size={40} className="text-slate-300" />
            </div>
          )}

          {/* Specs & Description */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700">
              {isCar ? (
                <>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Calendar size={13} className="text-indigo-600" /> {property.year || 2022}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Gauge size={13} className="text-indigo-600" /> {(property.mileage || 0).toLocaleString()} mi
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Cog size={13} className="text-indigo-600" /> {property.transmission || 'Automatic'}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Fuel size={13} className="text-indigo-600" /> {property.fuel_type || 'Gasoline'}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Bed size={13} className="text-brand" /> {property.beds || 3} Bedrooms
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Bath size={13} className="text-brand" /> {property.baths || 2.5} Bathrooms
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Maximize2 size={13} className="text-brand" /> {(property.sqft || 2000).toLocaleString()} Sq Ft
                  </span>
                  {property.garages ? (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1.5 font-bold">
                        <CarIcon size={13} className="text-brand" /> {property.garages} Car Garage
                      </span>
                    </>
                  ) : null}
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Asset Overview</h4>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                {property.description || 'No description provided.'}
              </p>
            </div>

            {/* Original Listing External Button */}
            {property.property_url && (
              <a
                href={property.property_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
              >
                <span>View original deed & MLS listing source</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Financial Breakdown & Equity Calculator */}
          <div className="p-5 sm:p-6 space-y-5 bg-slate-50/50">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Institutional Valuation & Financing Schedule
            </h4>

            {/* Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Valuation</span>
                <span className="text-sm font-extrabold text-slate-900 tabular-nums">{fmt(property.price)}</span>
              </div>
              <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  {property.down_payment_percent}% Down Req.
                </span>
                <span className="text-sm font-extrabold text-emerald-700 tabular-nums">{fmt(minRequiredDown)}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Monthly</span>
                <span className="text-sm font-extrabold text-indigo-700 tabular-nums">{fmt(calculatedMonthly)}/mo</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Wallet</span>
                <span className={`text-sm font-extrabold tabular-nums ${hasSufficientWallet ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {fmt(walletBalance)}
                </span>
              </div>
            </div>

            {/* Conveyance Notice */}
            <div className="p-4 rounded-2xl bg-brand/5 border border-brand/10 text-xs text-brand-dark flex items-start gap-3">
              <ShieldCheck size={18} className="text-brand shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Deed Equity & Flexible Repayment:</span> Upon paying the 20% down payment (or higher), your fractional title deed is executed. You gain immediate asset rights and can amortize the balance across <strong>2 to 6 years</strong>.
              </div>
            </div>

            {/* Form */}
            {isSold ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                <CheckCircle size={18} className="text-rose-600 shrink-0" />
                <span>This asset has reached full capitalization and cannot accept further allocations.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Initial Down Payment Allocation (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={minRequiredDown}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                        placeholder={`Min ${fmt(minRequiredDown)}`}
                        required
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Min down payment: {fmt(minRequiredDown)} ({property.down_payment_percent}%)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Amortization Span (Remaining Balance)
                    </label>
                    <select
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                    >
                      <option value="24">2 Years (24 Months)</option>
                      <option value="36">3 Years (36 Months)</option>
                      <option value="48">4 Years (48 Months)</option>
                      <option value="60">5 Years (60 Months)</option>
                      <option value="72">6 Years (72 Months)</option>
                    </select>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Est. monthly: {fmt(calculatedMonthly)}/mo
                    </span>
                  </div>
                </div>

                {!hasSufficientWallet && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-amber-600 shrink-0" />
                      <span>Wallet balance ({fmt(walletBalance)}) is below the required payment ({fmt(numericPayment)}).</span>
                    </div>
                    <Link
                      to="/app/wallet"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] whitespace-nowrap transition"
                    >
                      Deposit Now
                    </Link>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !hasSufficientWallet}
                    className="flex-1 py-3 px-5 rounded-2xl bg-brand hover:bg-brand-dark text-white font-extrabold text-xs sm:text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Processing Allocation...' : 'Confirm Allocation & Execute Deed'}
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
    </div>
  );
};
