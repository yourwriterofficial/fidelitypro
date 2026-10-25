import React from 'react';
import { Search, SlidersHorizontal, X, Building2, Car } from 'lucide-react';
import type { PropertyCategoryTab, PropertyFilterState } from '../../types/property';

interface PropertyFiltersProps {
  selectedTab: PropertyCategoryTab;
  onTabChange: (tab: PropertyCategoryTab) => void;
  houseCount: number;
  carCount: number;
  filters: PropertyFilterState;
  onFilterChange: <K extends keyof PropertyFilterState>(key: K, value: PropertyFilterState[K]) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  selectedTab,
  onTabChange,
  houseCount,
  carCount,
  filters,
  onFilterChange,
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="space-y-4">
      {/* ── TOP BAR: CATEGORY TABS & QUICK COUNTERS ──────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 shadow-xs">
          <button
            onClick={() => onTabChange('House')}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
              selectedTab === 'House'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 size={15} className={selectedTab === 'House' ? 'text-brand' : 'text-slate-400'} />
            <span>Houses & Estates</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              selectedTab === 'House' ? 'bg-brand/10 text-brand' : 'bg-slate-200/70 text-slate-600'
            }`}>
              {houseCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('Car')}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
              selectedTab === 'Car'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Car size={15} className={selectedTab === 'Car' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Cars & Luxury Vehicles</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              selectedTab === 'Car' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-600'
            }`}>
              {carCount}
            </span>
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition"
          >
            <X size={13} />
            <span>Reset Active Filters</span>
          </button>
        )}
      </div>

      {/* ── FILTER & SEARCH PANEL ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search Input and Price Range */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder={
                selectedTab === 'Car'
                  ? 'Search by make, model, year, location...'
                  : 'Search properties by title, city, address, state...'
              }
              value={filters.searchQuery}
              onChange={(e) => onFilterChange('searchQuery', e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand focus:border-transparent transition-all placeholder:text-slate-400"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onFilterChange('searchQuery', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Min</span>
              <input
                type="number"
                placeholder="$ 0"
                value={filters.minPrice}
                onChange={(e) => onFilterChange('minPrice', e.target.value)}
                className="w-20 bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Max</span>
              <input
                type="number"
                placeholder="$ Any"
                value={filters.maxPrice}
                onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                className="w-20 bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-400 text-[11px] uppercase tracking-wider mr-1">
            <SlidersHorizontal size={13} />
            <span>Refine:</span>
          </div>

          {selectedTab === 'House' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold text-[11px]">Bedrooms:</span>
                <select
                  value={filters.minBeds}
                  onChange={(e) => onFilterChange('minBeds', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="">Any Beds</option>
                  <option value="1">1+ Bedroom</option>
                  <option value="2">2+ Bedrooms</option>
                  <option value="3">3+ Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                  <option value="5">5+ Bedrooms</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold text-[11px]">Bathrooms:</span>
                <select
                  value={filters.minBaths}
                  onChange={(e) => onFilterChange('minBaths', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="">Any Baths</option>
                  <option value="1">1+ Bath</option>
                  <option value="1.5">1.5+ Baths</option>
                  <option value="2">2+ Baths</option>
                  <option value="2.5">2.5+ Baths</option>
                  <option value="3">3+ Baths</option>
                  <option value="4">4+ Baths</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold text-[11px]">Transmission:</span>
                <select
                  value={filters.carTrans}
                  onChange={(e) => onFilterChange('carTrans', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="">Any Transmission</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold text-[11px]">Fuel Type:</span>
                <select
                  value={filters.carFuel}
                  onChange={(e) => onFilterChange('carFuel', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="">Any Fuel</option>
                  <option value="Gasoline">Gasoline</option>
                  <option value="Electric">Electric</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Diesel">Diesel</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
