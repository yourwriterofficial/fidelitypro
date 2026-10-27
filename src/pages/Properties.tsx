import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, Plus, ShieldCheck, ArrowRight, AlertCircle, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import { useProperties } from '../hooks/useProperties';
import type { Property } from '../types/property';
import { PropertyCard } from '../components/properties/PropertyCard';
import { PropertyFilters } from '../components/properties/PropertyFilters';
import { PropertyInvestModal } from '../components/properties/PropertyInvestModal';
import { CustomAcquisitionModal } from '../components/properties/CustomAcquisitionModal';
import { MyPropertiesSection } from '../components/properties/MyPropertiesSection';

export default function Properties() {
  const { profile } = useAuthStore();
  const { propertyRestricted } = useAccountRestriction();

  const {
    loading,
    scrollSpeed,
    myInvestments,
    myCustomRequests,
    selectedTab,
    setSelectedTab,
    currentPage,
    setCurrentPage,
    filters,
    handleFilterChange,
    handleResetFilters,
    hasActiveFilters,
    likedIds,
    likingId,
    handleLike,
    handleInvestSubmit,
    handleCustomRequestSubmit,
    submittingInvest,
    submittingCustom,
    customSuccess,
    setCustomSuccess,
    houseCount,
    carCount,
    filteredProperties,
    paginatedProperties,
    totalPages,
  } = useProperties();

  // Modals state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [investModalOpen, setInvestModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const location = useLocation();

  const scrollToDeeds = () => {
    // Defer until the deeds section has rendered with the latest data.
    setTimeout(() => {
      document.getElementById('my-deeds')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Deep link from the purchase notification: /app/properties#my-deeds
  useEffect(() => {
    if (!loading && location.hash === '#my-deeds') scrollToDeeds();
  }, [loading, location.hash]);

  // Restriction Guard
  if (profile && (!profile.can_property || propertyRestricted)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Property Investments Suspended</h2>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          {propertyRestricted
            ? 'Property investment features are suspended due to account inactivity. Please top up your wallet to restore access.'
            : (profile.restriction_reason || 'Contact support to unlock property investments.')
          }
        </p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-2xl">
            A deposit of <strong>${profile.fee_required}</strong> is required to unlock.
          </p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-semibold hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  // Loading Skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-2xl w-72" />
        <div className="h-28 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-96 bg-slate-200 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 space-y-8">
      {/* ── TOP HEADER & PRIMARY ACTION ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white">
              Deed Marketplace
            </span>
            <span className="text-xs text-slate-400 font-medium">Fractional Title & Escrow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Property & Vehicle Exchange
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Acquire institutional real estate and luxury vehicles with 20% down, or submit external MLS/dealer listings for assisted corporate escrow.
          </p>
        </div>

        <button
          onClick={() => {
            setCustomSuccess(false);
            setCustomModalOpen(true);
          }}
          className="bg-brand hover:bg-brand-dark text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 shrink-0 self-start lg:self-auto active:scale-95"
        >
          <Plus size={16} />
          <span>Request Assisted Escrow</span>
        </button>
      </div>

      {/* ── MY FRACTIONAL DEEDS & ASSISTED ORDERS ──────────────────────────
          Shown above the catalog so purchased assets and title deeds are
          immediately visible instead of buried below pagination. */}
      <div id="my-deeds" className="scroll-mt-24">
        <MyPropertiesSection
          investments={myInvestments}
          customRequests={myCustomRequests}
          onRequestCustom={() => {
            setCustomSuccess(false);
            setCustomModalOpen(true);
          }}
        />
      </div>

      {/* ── ASSISTED ACQUISITION CONCIERGE BANNER ────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold text-emerald-300 backdrop-blur-md">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Assisted Corporate Acquisition & Escrow Desk</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Have an external property or luxury car you'd like RPM to acquire?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Found a listing on Zillow, Realtor, or AutoTrader? Paste the external listing URL, select up to a 5-year repayment plan, and fund your 20% upfront deposit. Our legal escrow desk manages the paperwork, inspection, and title conveyance.
            </p>
          </div>

          <button
            onClick={() => {
              setCustomSuccess(false);
              setCustomModalOpen(true);
            }}
            className="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 shrink-0 group active:scale-95"
          >
            <span>Paste Listing Link</span>
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── UNIFIED CATEGORY TABS & SEARCH FILTERS ───────────────────────── */}
      <PropertyFilters
        selectedTab={selectedTab}
        onTabChange={(tab) => {
          setSelectedTab(tab);
          setCurrentPage(1);
        }}
        houseCount={houseCount}
        carCount={carCount}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* ── PROPERTIES & ASSETS CATALOG GRID ─────────────────────────────── */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Building2 size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No {selectedTab === 'Car' ? 'vehicles' : 'properties'} match your filters
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query, price parameters, or reset active filters.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProperties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                scrollSpeed={scrollSpeed}
                isLiked={likedIds.has(p.id)}
                isLiking={likingId === p.id}
                onLike={handleLike}
                onSelect={(selected) => {
                  setSelectedProperty(selected);
                  setInvestModalOpen(true);
                }}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-slate-700 shadow-xs"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-9 h-9 text-xs font-extrabold rounded-xl transition ${
                      currentPage === page
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-slate-700 shadow-xs"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {selectedProperty && (
        <PropertyInvestModal
          property={selectedProperty}
          isOpen={investModalOpen}
          onClose={() => {
            setInvestModalOpen(false);
            setSelectedProperty(null);
          }}
          scrollSpeed={scrollSpeed}
          walletBalance={profile?.wallet_balance || 0}
          isLiked={likedIds.has(selectedProperty.id)}
          isLiking={likingId === selectedProperty.id}
          onLike={handleLike}
          onSubmitInvest={async (amount, termMonths) => {
            await handleInvestSubmit(selectedProperty, amount, termMonths);
            setInvestModalOpen(false);
            scrollToDeeds();
          }}
          submitting={submittingInvest}
        />
      )}

      <CustomAcquisitionModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        walletBalance={profile?.wallet_balance || 0}
        onSubmit={handleCustomRequestSubmit}
        submitting={submittingCustom}
        success={customSuccess}
      />
    </div>
  );
}
