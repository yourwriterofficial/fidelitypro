import React from 'react';
import { 
  Building2, Heart, Calendar, MapPin, 
  Bed, Bath, Maximize2, Car as CarIcon, Gauge, Fuel, Cog, ArrowUpRight, CheckCircle 
} from 'lucide-react';
import type { Property } from '../../types/property';
import { PropertyImageCarousel } from './PropertyImageCarousel';

interface PropertyCardProps {
  property: Property;
  scrollSpeed: number;
  isLiked: boolean;
  isLiking: boolean;
  onLike: (e: React.MouseEvent, id: string) => void;
  onSelect: (property: Property) => void;
}

const formatLikes = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  scrollSpeed,
  isLiked,
  isLiking,
  onLike,
  onSelect,
}) => {
  const isSold = property.status === 'sold';
  const isCar = property.category === 'Car';
  const downPaymentAmount = property.price * (property.down_payment_percent / 100);

  return (
    <div 
      className="group bg-white rounded-3xl border border-slate-200/80 hover:border-slate-300/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col relative"
    >
      {/* ── IMAGE / MEDIA HEADER ────────────────────────────────────────── */}
      <div className="relative h-56 sm:h-60 overflow-hidden bg-slate-900">
        {property.image_urls && property.image_urls.length > 0 ? (
          <div className={`h-full w-full ${isSold ? 'opacity-50 grayscale' : ''}`}>
            <PropertyImageCarousel
              urls={property.image_urls}
              title={property.title}
              speed={scrollSpeed}
            />
          </div>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            {isCar ? (
              <CarIcon size={44} className="text-slate-600" />
            ) : (
              <Building2 size={44} className="text-slate-600" />
            )}
          </div>
        )}

        {/* Floating Category / Status Tag */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
          {isSold ? (
            <span className="px-3 py-1 rounded-full bg-rose-600/95 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
              Sold Out
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/10 text-[10px] font-bold tracking-wide shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isCar ? 'Luxury Vehicle' : 'Tokenized Real Estate'}
            </span>
          )}
        </div>

        {/* Floating Like / Interest Button */}
        {!isSold && (
          <button
            onClick={(e) => onLike(e, property.id)}
            disabled={isLiking}
            className={`absolute top-3 right-3 flex items-center gap-1.5 backdrop-blur-md text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all duration-200 z-10 ${
              isLiked
                ? 'bg-rose-500 text-white scale-105 shadow-rose-500/20'
                : 'bg-slate-900/70 text-slate-200 hover:bg-white hover:text-rose-500 border border-white/10'
            }`}
            title={isLiked ? 'You liked this asset' : 'Like this asset'}
          >
            <Heart
              size={12}
              className={`transition-transform duration-200 ${isLiked ? 'fill-current scale-110' : ''}`}
            />
            <span className="text-[11px] font-bold">
              {isLiking ? '...' : formatLikes(property.interested_count || 0)}
            </span>
          </button>
        )}

        {/* Location Pill pinned at bottom-left */}
        {property.location && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-medium border border-white/10 max-w-[85%] truncate">
            <MapPin size={12} className="text-emerald-400 shrink-0" />
            <span className="truncate">{property.location}</span>
          </div>
        )}
      </div>

      {/* ── CARD BODY ───────────────────────────────────────────────────── */}
      <div className="p-5 flex flex-col flex-1">
        {/* Title & Valuation */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 
            className="text-base font-bold text-slate-900 group-hover:text-brand transition-colors line-clamp-1"
            title={property.title}
          >
            {property.title}
          </h3>
        </div>

        {/* Short Description */}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3.5 min-h-[32px]">
          {property.description}
        </p>

        {/* Specs Badges Strip */}
        <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-600 mb-4 overflow-x-auto scrollbar-none">
          {isCar ? (
            <>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Calendar size={12} className="text-slate-400" /> {property.year || 2022}
              </span>
              <span className="text-slate-200">•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Gauge size={12} className="text-slate-400" /> {(property.mileage || 0).toLocaleString()} mi
              </span>
              <span className="text-slate-200">•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Cog size={12} className="text-slate-400" /> {property.transmission || 'Auto'}
              </span>
              <span className="text-slate-200">•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Fuel size={12} className="text-slate-400" /> {property.fuel_type || 'Gas'}
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Bed size={12} className="text-slate-400" /> {property.beds || 3} Beds
              </span>
              <span className="text-slate-200">•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Bath size={12} className="text-slate-400" /> {property.baths || 2.5} Baths
              </span>
              <span className="text-slate-200">•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                <Maximize2 size={12} className="text-slate-400" /> {(property.sqft || 2000).toLocaleString()} sqft
              </span>
              {property.garages ? (
                <>
                  <span className="text-slate-200">•</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                    <CarIcon size={12} className="text-slate-400" /> {property.garages} Car
                  </span>
                </>
              ) : null}
            </>
          )}
        </div>

        {/* Financial Metrics Matrix */}
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 mb-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Valuation</span>
            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
              {fmt(property.price)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {property.down_payment_percent}% Down Payment
            </span>
            <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
              {fmt(downPaymentAmount)}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Monthly from</span>
            <span className="text-xs font-bold text-indigo-700 tabular-nums">
              {fmt(property.monthly_payment)}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Financing Span</span>
            <span className="text-xs font-bold text-slate-700 tabular-nums">
              {property.term_months} Months
            </span>
          </div>
        </div>

        {/* Action Button */}
        {isSold ? (
          <button
            disabled
            className="w-full mt-auto py-3 px-4 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200/80"
          >
            <CheckCircle size={14} /> Asset Sold Out
          </button>
        ) : (
          <button
            onClick={() => onSelect(property)}
            className="w-full mt-auto py-3 px-4 rounded-2xl bg-slate-900 hover:bg-brand text-white font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md group/btn active:scale-[0.99]"
          >
            <Building2 size={14} className="text-emerald-400 group-hover/btn:text-white transition-colors" />
            <span>View Deed & Invest</span>
            <ArrowUpRight size={14} className="opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-all" />
          </button>
        )}
      </div>
    </div>
  );
};
