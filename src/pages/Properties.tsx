import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { AlertCircle, Building2, X, DollarSign, Calendar, Percent, CheckCircle, Heart, Search, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { useAccountRestriction } from '../hooks/useAccountRestriction';

interface Property {
  id: string; title: string; description: string; price: number;
  down_payment_percent: number; monthly_payment: number; term_months: number;
  image_urls: string[]; interested_count: number; status: string; category?: string;
  location?: string; beds?: number; baths?: number; sqft?: number; garages?: number;
  year?: number; make?: string; car_model?: string; mileage?: number; transmission?: string; fuel_type?: string;
  property_url?: string;
}

const formatLikes = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
};

function PropertyImageCarousel({ urls, title, speed }: { urls: string[], title: string, speed: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!urls || urls.length <= 1 || speed <= 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % urls.length);
    }, speed * 1000);
    return () => clearInterval(interval);
  }, [urls, speed]);

  return (
    <div className="relative h-full w-full overflow-hidden flex">
      {urls.map((url, i) => {
        // Only render the image element if it is active or adjacent to the visible slide.
        // This stops the browser from requesting 57 images per card simultaneously on load.
        const isActiveOrAdjacent = i === index || i === (index - 1 + urls.length) % urls.length || i === (index + 1) % urls.length;
        return (
          <div
            key={i}
            className="absolute inset-0 w-full h-full transition-transform duration-700 ease-in-out"
            style={{
              transform: `translateX(${(i - index) * 100}%)`,
            }}
          >
            {isActiveOrAdjacent && (
              <img
                src={url}
                alt={`${title} ${i + 1}`}
                className="w-full h-full object-cover"
                loading={i === 0 ? "eager" : "lazy"}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Properties() {
  const { profile } = useAuthStore();
  const { propertyRestricted } = useAccountRestriction();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('24');
  const [myInvestments, setMyInvestments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [selectedTab, setSelectedTab] = useState<'House' | 'Car'>('House');
  const [currentPage, setCurrentPage] = useState(1);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [minBaths, setMinBaths] = useState('');
  const [carTrans, setCarTrans] = useState('');
  const [carFuel, setCarFuel] = useState('');

  // Likes tracking
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);

  const fetchProperties = async () => {
    const { data, error } = await supabase.from('properties').select('*').in('status', ['active', 'sold']);
    if (error) toast.error('Failed to load properties');
    else {
      // Randomize listings on every reload
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      setProperties(shuffled);
    }
    setLoading(false);
  };

  const fetchMyInvestments = async () => {
    if (!profile) return;
    const { data, error } = await supabase.from('property_investments').select('*, property:property_id(title)').eq('user_id', profile.id);
    if (!error) setMyInvestments(data || []);
  };

  const fetchScrollSpeed = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'property_scroll_speed')
        .single();
      if (!error && data) {
        setScrollSpeed(parseInt(data.value) || 3);
      }
    } catch (err) {
      console.warn('Failed loading scroll speed setting:', err);
    }
  };

  const fetchLikes = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('property_likes')
      .select('property_id')
      .eq('user_id', profile.id);
    if (data) setLikedIds(new Set(data.map((r: any) => r.property_id)));
  };

  const handleLike = async (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    if (!profile) { toast.error('Please log in to like listings.'); return; }
    if (likedIds.has(propertyId)) {
      toast('You already liked this listing! ❤️', { description: 'Each listing can only be liked once.' });
      return;
    }
    setLikingId(propertyId);
    try {
      // Insert like record
      const { error: likeErr } = await supabase
        .from('property_likes')
        .insert({ user_id: profile.id, property_id: propertyId });
      if (likeErr) throw likeErr;

      // Increment count in properties table
      await supabase.rpc('increment_likes', { row_id: propertyId });

      // Optimistic local update
      setLikedIds(prev => new Set([...prev, propertyId]));
      setProperties(prev =>
        prev.map(p => p.id === propertyId
          ? { ...p, interested_count: (p.interested_count || 0) + 1 }
          : p
        )
      );
      toast.success('Liked! ❤️', { description: 'Your like has been recorded.' });
    } catch (err: any) {
      if (err?.code === '23505') {
        // Unique constraint — already liked
        setLikedIds(prev => new Set([...prev, propertyId]));
        toast('You already liked this listing! ❤️');
      } else {
        toast.error('Could not record like. Try again.');
      }
    } finally {
      setLikingId(null);
    }
  };

  useEffect(() => { 
    fetchProperties(); 
    fetchMyInvestments(); 
    fetchScrollSpeed();
    fetchLikes();
  }, []);

  if (profile && (!profile.can_property || propertyRestricted)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Property Investments Suspended</h2>
        <p className="text-gray-500 text-sm mt-2">
          {propertyRestricted
            ? 'Property investment features are suspended due to account inactivity. Please top up your wallet to restore access.'
            : (profile.restriction_reason || 'Contact support to unlock property investments.')
          }
        </p>
        {profile.fee_required > 0 && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">A deposit of <strong>${profile.fee_required}</strong> is required to unlock.</p>
        )}
        <Link to="/app" className="mt-5 inline-block text-brand text-sm font-medium hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProperty) return;
    if (!profile.can_property || propertyRestricted) { toast.error('Property investments are disabled for your account'); return; }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > profile.wallet_balance) { toast.error('Insufficient balance'); return; }
    setSubmitting(true);
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount });
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'investment',
        amount: -amount,
        description: `Property Investment: ${selectedProperty.title}`,
        status: 'completed',
      });
      const downPaymentRequired = selectedProperty.price * (selectedProperty.down_payment_percent / 100);
      const remaining = Math.max(0, selectedProperty.price - amount);
      const termMonthsVal = parseInt(selectedTerm);
      const monthlyPaymentVal = parseFloat((remaining / termMonthsVal).toFixed(2));

      const { error } = await supabase.from('property_investments').insert({
        user_id: profile.id,
        property_id: selectedProperty.id,
        amount_paid: amount,
        remaining_balance: remaining,
        down_payment_paid: amount >= downPaymentRequired,
        status: amount >= downPaymentRequired ? 'active' : 'pending',
        term_months: termMonthsVal,
        monthly_payment: monthlyPaymentVal,
      });
      if (error) throw error;
      toast.success('Investment recorded!');
      await fetchMyInvestments();
      setModalOpen(false); setPaymentAmount('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-80" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Investment</h1>
        <p className="text-gray-500 text-sm mt-0.5">Invest in real estate with flexible payment terms.</p>
      </div>

      {/* House / Car Tabs Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => { setSelectedTab('House'); setCurrentPage(1); }}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            selectedTab === 'House'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Houses & Apartments
        </button>
        <button
          onClick={() => { setSelectedTab('Car'); setCurrentPage(1); }}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            selectedTab === 'Car'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Cars & Vehicles
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={selectedTab === 'Car' ? "Search cars by brand, model, location..." : "Search properties by address, location, category..."}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-sm focus:bg-white focus:ring-2 focus:ring-brand focus:border-transparent font-medium transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Min Price</span>
              <input
                type="number"
                placeholder="$ Min"
                value={minPrice}
                onChange={e => { setMinPrice(e.target.value); setCurrentPage(1); }}
                className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Max Price</span>
              <input
                type="number"
                placeholder="$ Max"
                value={maxPrice}
                onChange={e => { setMaxPrice(e.target.value); setCurrentPage(1); }}
                className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand transition-all"
              />
            </div>
            {(searchQuery || minPrice || maxPrice || minBeds || minBaths || carTrans || carFuel) && (
              <button
                onClick={() => {
                  setSearchQuery(''); setMinPrice(''); setMaxPrice('');
                  setMinBeds(''); setMinBaths(''); setCarTrans(''); setCarFuel('');
                  setCurrentPage(1);
                }}
                className="text-xs text-brand hover:underline font-bold"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Feature Filters */}
        <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
            <SlidersHorizontal size={14} />
            <span>Filters:</span>
          </div>

          {selectedTab === 'House' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Beds</span>
                <select
                  value={minBeds}
                  onChange={e => { setMinBeds(e.target.value); setCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-base md:text-xs font-medium focus:bg-white transition-all"
                >
                  <option value="">Any Beds</option>
                  <option value="1">1+ Bed</option>
                  <option value="2">2+ Beds</option>
                  <option value="3">3+ Beds</option>
                  <option value="4">4+ Beds</option>
                  <option value="5">5+ Beds</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Baths</span>
                <select
                  value={minBaths}
                  onChange={e => { setMinBaths(e.target.value); setCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-base md:text-xs font-medium focus:bg-white transition-all"
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Transmission</span>
                <select
                  value={carTrans}
                  onChange={e => { setCarTrans(e.target.value); setCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-base md:text-xs font-medium focus:bg-white transition-all"
                >
                  <option value="">Any Trans</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Fuel Type</span>
                <select
                  value={carFuel}
                  onChange={e => { setCarFuel(e.target.value); setCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-base md:text-xs font-medium focus:bg-white transition-all"
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

      {/* Properties Grid */}
      {(() => {
        const filtered = properties.filter(p => {
          // 1. Tab check
          if (selectedTab === 'Car') {
            if (p.category !== 'Car') return false;
          } else {
            if (p.category === 'Car') return false;
          }

          // 2. Search query check
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchTitle = (p.title || '').toLowerCase().includes(q);
            const matchLoc = (p.location || '').toLowerCase().includes(q);
            const matchMake = (p.make || '').toLowerCase().includes(q);
            const matchModel = (p.car_model || '').toLowerCase().includes(q);
            const matchDesc = (p.description || '').toLowerCase().includes(q);
            if (!matchTitle && !matchLoc && !matchMake && !matchModel && !matchDesc) return false;
          }

          // 3. Price check
          if (minPrice && p.price < parseFloat(minPrice)) return false;
          if (maxPrice && p.price > parseFloat(maxPrice)) return false;

          // 4. Feature checks
          if (selectedTab === 'House') {
            if (minBeds && (p.beds || 0) < parseInt(minBeds)) return false;
            if (minBaths && (p.baths || 0) < parseFloat(minBaths)) return false;
          } else {
            if (carTrans && p.transmission !== carTrans) return false;
            if (carFuel && p.fuel_type !== carFuel) return false;
          }

          return true;
        });

        const itemsPerPage = 12;
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if (filtered.length === 0) {
          return (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No {selectedTab === 'Car' ? 'cars' : 'properties'} available at the moment.</p>
            </div>
          );
        }

        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginated.map(p => (
                <div key={p.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col relative">
                  {/* Image Carousel */}
                  {p.image_urls && p.image_urls.length > 0 ? (
                    <div className="relative h-48 overflow-hidden">
                      <div className={`h-full w-full ${p.status === 'sold' ? 'opacity-55 grayscale' : ''}`}>
                        <PropertyImageCarousel urls={p.image_urls} title={p.title} speed={scrollSpeed} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                      {p.status === 'sold' ? (
                        <div className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full shadow-md z-10">
                          Sold Out
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleLike(e, p.id)}
                          disabled={likingId === p.id}
                          className={`absolute bottom-3 left-3 flex items-center gap-1.5 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm transition-all duration-200 ${
                            likedIds.has(p.id)
                              ? 'bg-red-500 text-white scale-105'
                              : 'bg-white/90 text-gray-500 hover:bg-red-50 hover:text-red-500'
                          }`}
                          title={likedIds.has(p.id) ? 'You liked this' : 'Like this listing'}
                        >
                          <Heart
                            size={11}
                            className={likedIds.has(p.id) ? 'fill-current' : ''}
                          />
                          {likingId === p.id ? '...' : formatLikes(p.interested_count || 0)}
                          {likedIds.has(p.id) ? ' ✓' : ' like this'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                      <Building2 size={48} className="text-gray-300" />
                      {p.status === 'sold' && (
                        <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full shadow-md">
                          Sold Out
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {p.category && (
                      <span className="self-start mb-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand/10 text-brand">{p.category}</span>
                    )}
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand transition-colors">{p.title}</h3>
                    {p.location && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 shrink-0">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {p.location}
                      </p>
                    )}
                    <p className="text-gray-500 text-sm mt-1 mb-3 line-clamp-2">{p.description}</p>
                    
                    {p.category === 'Car' ? (
                      <div className="flex flex-wrap items-center gap-2 mt-1 mb-4 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shrink-0">
                        <span className="font-semibold text-gray-700">{p.year || 2020} Yr</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{(p.mileage || 0).toLocaleString()} mi</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{p.transmission || 'Auto'}</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{p.fuel_type || 'Gas'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 mt-1 mb-4 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shrink-0">
                        <span className="font-semibold text-gray-700">{p.beds || 3} Bed</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{p.baths || 2.5} Bath</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{(p.sqft || 2000).toLocaleString()} Sq Ft</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">{p.garages || 2} Car</span>
                      </div>
                    )}

                    <div className="space-y-2 text-sm flex-1">
                      {[
                        { icon: <DollarSign size={14} />, label: 'Price',           value: fmt(p.price) },
                        { icon: <Percent    size={14} />, label: 'Down Payment',    value: `${p.down_payment_percent}% (${fmt(p.price * p.down_payment_percent / 100)})` },
                        { icon: <Calendar  size={14} />, label: 'Monthly Payment', value: fmt(p.monthly_payment) },
                        { icon: <Calendar  size={14} />, label: 'Term',            value: `${p.term_months} months` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-gray-400 flex items-center gap-1.5">{icon}{label}</span>
                          <span className="font-semibold text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>

                    {p.status === 'sold' ? (
                      <button
                        disabled
                        className="mt-5 w-full bg-gray-150 text-gray-400 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-gray-200"
                      >
                        <CheckCircle size={16} /> Sold Out
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedProperty(p); setModalOpen(true); }}
                        className="mt-5 w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                      >
                        <Building2 size={16} /> Invest Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 shrink-0">
                <button
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-10 h-10 text-sm font-semibold rounded-xl transition ${
                      currentPage === page
                        ? 'bg-brand text-white'
                        : 'border bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Investment Modal */}
      {modalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Property Details & Investment</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedProperty.title}</p>
                {selectedProperty.location && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 shrink-0">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedProperty.location}
                  </p>
                )}
                {likedIds.has(selectedProperty.id) && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                    <Heart size={10} className="fill-current" /> You already liked this listing
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleLike(e, selectedProperty.id)}
                  disabled={likingId === selectedProperty.id}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                    likedIds.has(selectedProperty.id)
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-500'
                  }`}
                  title={likedIds.has(selectedProperty.id) ? 'Already liked' : 'Like this listing'}
                >
                  <Heart size={13} className={likedIds.has(selectedProperty.id) ? 'fill-current' : ''} />
                  {likedIds.has(selectedProperty.id) ? 'Liked' : 'Like'}
                </button>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Scrolling gallery of property images */}
            {selectedProperty.image_urls && selectedProperty.image_urls.length > 0 ? (
              <div className="relative h-60 w-full bg-gray-100 shrink-0">
                <PropertyImageCarousel urls={selectedProperty.image_urls} title={selectedProperty.title} speed={scrollSpeed} />
              </div>
            ) : (
              <div className="h-48 w-full bg-gray-50 flex items-center justify-center shrink-0 border-b">
                <Building2 size={40} className="text-gray-300" />
              </div>
            )}

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Detailed Description */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</h3>
                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed whitespace-pre-line">
                  {selectedProperty.description || 'No description provided.'}
                </p>
              </div>

              {/* Specs Row */}
              {selectedProperty.category === 'Car' ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shrink-0">
                  <span className="font-semibold text-gray-700">{selectedProperty.year || 2020} Yr</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{selectedProperty.make} {selectedProperty.car_model}</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{(selectedProperty.mileage || 0).toLocaleString()} Miles</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{selectedProperty.transmission || 'Auto'}</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{selectedProperty.fuel_type || 'Gas'}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shrink-0">
                  <span className="font-semibold text-gray-700">{selectedProperty.beds || 3} Bed</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{selectedProperty.baths || 2.5} Bath</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{(selectedProperty.sqft || 2000).toLocaleString()} Sq Ft</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{selectedProperty.garages || 2} Car Garage</span>
                </div>
              )}

              {/* Financial Stats */}
              <div className="bg-gray-50 rounded-2xl p-4 grid grid-cols-2 gap-4 text-sm border">
                <div>
                  <p className="text-gray-400 text-xs font-medium">Full Valuation</p>
                  <p className="font-bold text-gray-900 text-base">{fmt(selectedProperty.price)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">Down Payment</p>
                  <p className="font-bold text-gray-900 text-base">{fmt(selectedProperty.price * selectedProperty.down_payment_percent / 100)} ({selectedProperty.down_payment_percent}%)</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">Your Wallet Balance</p>
                  <p className="font-bold text-emerald-600 text-base">{fmt(profile?.wallet_balance || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">Monthly Installment</p>
                  <p className="font-bold text-gray-900 text-base">{fmt(selectedProperty.monthly_payment)}</p>
                </div>
              </div>

              {/* Ownership Informational Alert */}
              <div className="bg-brand/5 border border-brand/10 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed text-brand-dark">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-brand" />
                <div>
                  <span className="font-bold">Ownership & Flexible Repayment Notice:</span> Once you make the initial down payment (or higher), you officially own this {selectedProperty.category === 'Car' ? 'vehicle' : 'home'} and gain immediate access. You can choose to spread the remaining balance over a flexible period of <strong>2 to 6 years</strong>, paying it off little by little.
                </div>
              </div>

              {/* View Original Listing Button */}
              {selectedProperty.property_url && (
                <a
                  href={selectedProperty.property_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border-2 border-brand text-brand hover:bg-brand hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all duration-200 group"
                >
                  <ExternalLink size={15} className="group-hover:scale-110 transition-transform" />
                  View Original {selectedProperty.category === 'Car' ? 'Vehicle Listing' : 'Property Listing'}
                </a>
              )}

              {/* Investment Payment Form */}
              {selectedProperty.status === 'sold' ? (
                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl text-center space-y-3 shrink-0">
                  <AlertCircle size={28} className="text-red-500 mx-auto" />
                  <h4 className="font-bold text-red-800 text-sm">Asset Sold Out</h4>
                  <p className="text-xs text-red-600 max-w-sm mx-auto leading-relaxed">
                    This listing has already been fully purchased by another investor. You can browse other available properties or vehicles in the catalog.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition"
                  >
                    Close Details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInvest} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount to Invest (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number" step="0.01" min={selectedProperty.price * selectedProperty.down_payment_percent / 100}
                      value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                      placeholder={`Min payment is ${fmt(selectedProperty.price * selectedProperty.down_payment_percent / 100)}`} required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Repayment Term for Remaining Balance</label>
                  <select
                    value={selectedTerm}
                    onChange={e => setSelectedTerm(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                  >
                    <option value="24">2 Years (24 Months)</option>
                    <option value="36">3 Years (36 Months)</option>
                    <option value="48">4 Years (48 Months)</option>
                    <option value="60">5 Years (60 Months)</option>
                    <option value="72">6 Years (72 Months)</option>
                  </select>
                </div>

                {paymentAmount && !isNaN(parseFloat(paymentAmount)) && (
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Property Price:</span>
                      <span className="font-semibold text-gray-800">{fmt(selectedProperty.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Your Initial Payment:</span>
                      <span className="font-semibold text-gray-800">{fmt(parseFloat(paymentAmount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Remaining Balance:</span>
                      <span className="font-semibold text-gray-800">
                        {fmt(Math.max(0, selectedProperty.price - parseFloat(paymentAmount)))}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-500 font-medium">Estimated Monthly Installment:</span>
                      <span className="font-bold text-brand-dark">
                        {fmt(Math.max(0, selectedProperty.price - parseFloat(paymentAmount)) / parseInt(selectedTerm))}/month
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-sm">
                    {submitting ? 'Processing...' : 'Submit Payment'}
                  </button>
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm transition font-semibold">Cancel</button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Investments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Property & Car Investments</h2>
        </div>
        {myInvestments.length === 0 ? (
          <p className="p-8 text-gray-400 text-sm text-center">No property investments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Asset', 'Amount Paid', 'Remaining', 'Term', 'Installment', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myInvestments.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{inv.property?.title || 'N/A'}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium tabular-nums">{fmt(inv.amount_paid)}</td>
                    <td className="px-4 py-3.5 tabular-nums">{fmt(inv.remaining_balance)}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-600">{inv.term_months ? `${inv.term_months} months` : '12 months'}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(inv.monthly_payment || 0)}/mo</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${inv.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {inv.status === 'active' && <CheckCircle size={11} />}
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
