import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { 
  AlertCircle, Building2, X, DollarSign, Calendar, Percent, 
  CheckCircle, Heart, Search, SlidersHorizontal, ExternalLink,
  Plus, ShieldCheck, CheckCircle2, Wallet, ArrowRight, Car, Briefcase, TrendingUp
} from 'lucide-react';
import { useAccountRestriction } from '../hooks/useAccountRestriction';
import { notifyAdmins } from '../lib/notify';

interface Property {
  id: string; title: string; description: string; price: number;
  down_payment_percent: number; monthly_payment: number; term_months: number;
  image_urls: string[]; interested_count: number; status: string; category?: string;
  location?: string; beds?: number; baths?: number; sqft?: number; garages?: number;
  year?: number; make?: string; car_model?: string; mileage?: number; transmission?: string; fuel_type?: string;
  property_url?: string;
}

interface CustomPropertyRequest {
  id: string;
  category: string;
  external_url: string;
  location: string;
  total_price: number;
  upfront_deposit: number;
  is_national_or_resident: boolean;
  begin_documentation_immediately: boolean;
  term_months: number;
  monthly_payment: number;
  status: string;
  created_at: string;
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

  // Custom Acquisition Request State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState<'House' | 'Car'>('House');
  const [customUrl, setCustomUrl] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customIsResident, setCustomIsResident] = useState<'yes' | 'no'>('yes');
  const [customBeginImmediate, setCustomBeginImmediate] = useState<'yes' | 'no'>('yes');
  const [customTerm, setCustomTerm] = useState('60');
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSubmittedSuccess, setCustomSubmittedSuccess] = useState(false);
  const [myCustomRequests, setMyCustomRequests] = useState<CustomPropertyRequest[]>([]);

  const fetchProperties = async () => {
    const { data, error } = await supabase.from('properties').select('*').in('status', ['active', 'sold']);
    if (error) toast.error('Failed to load properties');
    else {
      // Purge duplicates across both categories
      const seenTitles = new Set<string>();
      const uniqueList: Property[] = [];
      for (const item of (data || [])) {
        const key = `${(item.category || '').toLowerCase().trim()}-${(item.title || '').toLowerCase().trim()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          uniqueList.push(item);
        }
      }
      const shuffled = uniqueList.sort(() => Math.random() - 0.5);
      setProperties(shuffled);
    }
    setLoading(false);
  };

  const fetchMyInvestments = async () => {
    if (!profile) return;
    const { data, error } = await supabase.from('property_investments').select('*, property:property_id(title)').eq('user_id', profile.id);
    if (!error) setMyInvestments(data || []);
  };

  const fetchMyCustomRequests = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('custom_property_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setMyCustomRequests(data as any);
      }
    } catch (err) {
      console.warn('Failed loading custom property requests:', err);
    }
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
      const { error: likeErr } = await supabase
        .from('property_likes')
        .insert({ user_id: profile.id, property_id: propertyId });
      if (likeErr) throw likeErr;

      await supabase.rpc('increment_likes', { row_id: propertyId });

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
        setLikedIds(prev => new Set([...prev, propertyId]));
        toast('You already liked this listing! ❤️');
      } else {
        toast.error('Could not record like. Try again.');
      }
    } finally {
      setLikingId(null);
    }
  };

  const handleCustomRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('Please log in to submit a custom purchase request.');
      return;
    }
    const price = parseFloat(customPrice);
    if (!customUrl.trim()) {
      toast.error('Please provide a valid listing URL.');
      return;
    }
    if (!customLocation.trim()) {
      toast.error('Please provide property/vehicle location.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid total cost.');
      return;
    }

    const upfrontDeposit = price * 0.20;
    const termMonths = Math.min(60, Math.max(12, parseInt(customTerm) || 60));
    const remaining = Math.max(0, price - upfrontDeposit);
    const monthlyPayment = remaining / termMonths;

    setCustomSubmitting(true);
    try {
      const { error } = await supabase.from('custom_property_requests').insert({
        user_id: profile.id,
        user_name: profile.name,
        user_email: profile.email,
        category: customCategory,
        external_url: customUrl.trim(),
        location: customLocation.trim(),
        total_price: price,
        upfront_deposit: upfrontDeposit,
        is_national_or_resident: customIsResident === 'yes',
        begin_documentation_immediately: customBeginImmediate === 'yes',
        term_months: termMonths,
        monthly_payment: monthlyPayment,
        status: 'pending',
      });

      if (error) throw error;

      // Log notification message to support
      try {
        await supabase.from('messages').insert({
          user_id: profile.id,
          sender_id: profile.id,
          body: `[Custom ${customCategory} Acquisition Request] Link: ${customUrl.trim()} | Location: ${customLocation.trim()} | Total Cost: $${price.toLocaleString()} | 20% Deposit: $${upfrontDeposit.toLocaleString()} | Term: ${termMonths} Months ($${monthlyPayment.toFixed(2)}/mo) | National/Resident: ${customIsResident.toUpperCase()} | Immediate Documentation: ${customBeginImmediate.toUpperCase()}`,
          read: false,
        });
      } catch (_) {}

      notifyAdmins({
        title: 'New Custom Property Acquisition Request',
        message: `${profile.name || profile.email} submitted a custom ${customCategory} request ($${price.toLocaleString()} total, $${upfrontDeposit.toLocaleString()} deposit).`,
        type: 'alert',
        link: '/admin/properties'
      });

      toast.success('Custom Acquisition Request Received!', {
        description: 'Please deposit the 20% upfront sum into your RPM Wallet and upload KYC details in Settings.',
      });
      setCustomSubmittedSuccess(true);
      fetchMyCustomRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setCustomSubmitting(false);
    }
  };

  useEffect(() => { 
    fetchProperties(); 
    fetchMyInvestments(); 
    fetchMyCustomRequests();
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
      notifyAdmins({
        title: 'New Real Estate Deed Investment',
        message: `${profile.name || profile.email} invested $${amount.toLocaleString()} in ${selectedProperty.title} (${selectedTerm} Months).`,
        type: 'success',
        link: '/admin/properties'
      });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property & Vehicle Investment</h1>
          <p className="text-gray-500 text-sm mt-0.5">Invest in real estate and luxury vehicles, or request an assisted purchase for any external listing.</p>
        </div>
        <button
          onClick={() => { setCustomModalOpen(true); setCustomSubmittedSuccess(false); }}
          className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-dark hover:to-indigo-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-md hover:shadow-lg shadow-brand/15 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Request Assisted Purchase
        </button>
      </div>

      {/* Acquisition Desk Announcement Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-indigo-900/30">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-blue-200 backdrop-blur-sm">
            <ShieldCheck size={14} className="text-emerald-400" /> Assisted Acquisition & Escrow Desk
          </div>
          <h3 className="text-lg font-bold">Have an external property or car you'd like RPM to acquire for you?</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Found a home on Zillow/Realtor or a car on AutoTrader? Paste the external listing URL, choose up to a 5-year repayment plan, and fund your 20% upfront deposit into your RPM Wallet. Our dedicated acquisitions desk will handle the paperwork and conveyance.
          </p>
        </div>
        <button
          onClick={() => { setCustomModalOpen(true); setCustomSubmittedSuccess(false); }}
          className="bg-white hover:bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all whitespace-nowrap flex items-center gap-2 shrink-0 active:scale-95"
        >
          <span>Paste Listing Link</span>
          <ArrowRight size={15} />
        </button>
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

                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  <button type="submit" disabled={submitting}
                    className="w-full sm:flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-sm">
                    {submitting ? 'Processing...' : 'Submit Payment'}
                  </button>
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm transition font-semibold">Cancel</button>
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

      {/* My Assisted Acquisition Requests Table */}
      {myCustomRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase size={16} className="text-brand" /> My Assisted Acquisition Requests
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Track external property and car acquisition orders submitted for escrow.</p>
            </div>
            <button
              onClick={() => { setCustomModalOpen(true); setCustomSubmittedSuccess(false); }}
              className="text-xs font-bold text-brand hover:underline"
            >
              + New Request
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Category', 'Location', 'Total Price', '20% Deposit', 'Term', 'Est. Monthly', 'National', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myCustomRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900 flex items-center gap-2">
                      {req.category === 'Car' ? <Car size={14} className="text-indigo-500" /> : <Building2 size={14} className="text-brand" />}
                      <span>{req.category}</span>
                      <a href={req.external_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700" title="Open external listing">
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 truncate max-w-[180px]">{req.location}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(req.total_price)}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium tabular-nums">{fmt(req.upfront_deposit)}</td>
                    <td className="px-4 py-3.5 text-gray-600 tabular-nums">{req.term_months} Months</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 tabular-nums">{fmt(req.monthly_payment)}/mo</td>
                    <td className="px-4 py-3.5 text-xs text-gray-600">{req.is_national_or_resident ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-100 uppercase text-[10px] tracking-wider font-bold">
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assisted Custom Acquisition Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCustomModalOpen(false)} />
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col z-10 overflow-hidden shadow-2xl animate-scale-in border border-gray-100">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Building2 size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Request Assisted Purchase</h3>
                  <p className="text-xs text-slate-300">Submit an external House or Car listing link for RPM acquisition</p>
                </div>
              </div>
              <button 
                onClick={() => setCustomModalOpen(false)} 
                className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {customSubmittedSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={36} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Purchase Request Submitted!</h4>
                  <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                    Our Acquisitions Desk has received your request. To finalize escrow allocation and legal documentation, please complete the two steps below:
                  </p>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-left space-y-3.5 text-xs text-gray-700">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Deposit 20% Upfront Down Payment</p>
                        <p className="text-gray-500 mt-0.5">Ensure your required 20% down payment ({fmt((parseFloat(customPrice) || 0) * 0.20)}) is available in your RPM Wallet.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Upload KYC Verification Documents</p>
                        <p className="text-gray-500 mt-0.5">Go to Settings &gt; KYC to upload your ID / Passport for property conveyance.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Dedicated Escrow Representative Assignment</p>
                        <p className="text-gray-500 mt-0.5">A designated support agent will message you in your Inbox with contract documents.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Link
                      to="/app/wallet"
                      onClick={() => setCustomModalOpen(false)}
                      className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl text-center text-sm shadow-md transition"
                    >
                      Go to Wallet & Deposit
                    </Link>
                    <Link
                      to="/app/settings?tab=kyc"
                      onClick={() => setCustomModalOpen(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-center text-sm transition"
                    >
                      Upload KYC in Settings
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCustomRequestSubmit} className="space-y-5">
                  {/* Category Pill Switcher */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">Select Asset Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCustomCategory('House')}
                        className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                          customCategory === 'House'
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Building2 size={16} /> Real Estate / House
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomCategory('Car')}
                        className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                          customCategory === 'Car'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Car size={16} /> Vehicle / Car
                      </button>
                    </div>
                  </div>

                  {/* External URL */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      External Listing URL <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <ExternalLink className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                      <input
                        type="url"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder={customCategory === 'House' ? 'https://www.zillow.com/homedetails/... or Realtor.com link' : 'https://www.autotrader.com/... or Carvana link'}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Paste any direct public listing link from Zillow, Realtor, Redfin, AutoTrader, etc.</p>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Location / Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      placeholder="e.g. 742 Evergreen Terrace, Springfield, OR or Miami, FL"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                      required
                    />
                  </div>

                  {/* Total Cost */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Total Purchase Price (USD) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1000"
                        value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                        placeholder="e.g. 450000"
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent font-bold"
                        required
                      />
                    </div>
                  </div>

                  {/* 20% Calculation & Wallet Advisory Box */}
                  {customPrice && !isNaN(parseFloat(customPrice)) && parseFloat(customPrice) > 0 && (() => {
                    const price = parseFloat(customPrice);
                    const deposit20 = price * 0.20;
                    const termMonths = parseInt(customTerm) || 60;
                    const remaining = Math.max(0, price - deposit20);
                    const monthly = remaining / termMonths;
                    const walletBal = profile?.wallet_balance || 0;
                    const hasSufficient = walletBal >= deposit20;

                    return (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-200/60">
                          <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Price</span>
                            <span className="text-xs font-bold text-gray-900">{fmt(price)}</span>
                          </div>
                          <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100 shadow-xs">
                            <span className="text-[10px] text-emerald-700 font-bold uppercase block">20% Down</span>
                            <span className="text-xs font-bold text-emerald-700">{fmt(deposit20)}</span>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Est. Monthly</span>
                            <span className="text-xs font-bold text-indigo-700">{fmt(monthly)}/mo</span>
                          </div>
                        </div>

                        {/* Advisory Notice */}
                        <div className={`p-4 rounded-2xl text-xs flex flex-col gap-3 ${
                          hasSufficient 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-900/40 shadow-md'
                        }`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`p-1.5 rounded-xl shrink-0 ${hasSufficient ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-amber-400'}`}>
                              <Wallet size={16} />
                            </div>
                            <div className="leading-relaxed flex-1">
                              <p className="font-bold text-sm">
                                {hasSufficient ? 'Wallet Funded for 20% Deposit' : 'Build Towards Your 20% Down Payment'}
                              </p>
                              <p className={`mt-1 text-xs leading-relaxed ${hasSufficient ? 'text-emerald-700' : 'text-slate-300'}`}>
                                {hasSufficient
                                  ? `Your current wallet balance (${fmt(walletBal)}) fully satisfies the 20% upfront deposit (${fmt(deposit20)}). You are ready for conveyance.`
                                  : `You currently have ${fmt(walletBal)} available. You can top up your balance incrementally to reach the ${fmt(deposit20)} target, or stake your available funds in RPM high-yield staking pools (5.5% - 8% daily compounding) to accelerate your savings while your property documentation is pre-reviewed.`}
                              </p>
                            </div>
                          </div>

                          {!hasSufficient && (
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2 border-t border-white/10">
                              <Link
                                to="/app/wallet"
                                onClick={() => setCustomModalOpen(false)}
                                className="w-full sm:w-auto px-3 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-[11px] shadow-sm transition flex items-center justify-center gap-1.5"
                              >
                                <Plus size={13} /> Deposit & Save Towards Target
                              </Link>
                              <Link
                                to="/app/staking"
                                onClick={() => setCustomModalOpen(false)}
                                className="w-full sm:w-auto px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] shadow-sm transition flex items-center justify-center gap-1.5"
                              >
                                <TrendingUp size={13} /> Stake & Multiply Yield
                              </Link>
                              <Link
                                to="/app/settings?tab=kyc"
                                onClick={() => setCustomModalOpen(false)}
                                className="w-full sm:w-auto px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5"
                              >
                                <ShieldCheck size={13} /> Upload KYC in Settings
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Nationality & Permanent Residence */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Are you a national / permanent resident of the purchase region?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCustomIsResident('yes')}
                        className={`p-3 rounded-xl border text-xs font-bold transition ${
                          customIsResident === 'yes'
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Yes (National / Resident)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomIsResident('no')}
                        className={`p-3 rounded-xl border text-xs font-bold transition ${
                          customIsResident === 'no'
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        No (Foreign / Non-Resident)
                      </button>
                    </div>
                  </div>

                  {/* Begin Documentation Immediately */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Do you want to begin legal documentation & title deed conveyance immediately?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCustomBeginImmediate('yes')}
                        className={`p-3 rounded-xl border text-xs font-bold transition ${
                          customBeginImmediate === 'yes'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-700 ring-2 ring-emerald-500/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Yes, Begin Immediately
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomBeginImmediate('no')}
                        className={`p-3 rounded-xl border text-xs font-bold transition ${
                          customBeginImmediate === 'no'
                            ? 'bg-gray-100 border-gray-400 text-gray-800'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        No, Pre-Approval Review
                      </button>
                    </div>
                  </div>

                  {/* Repayment Time Span (Max 5 Years) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Financing Time Span (Max 5 Years)
                    </label>
                    <select
                      value={customTerm}
                      onChange={e => setCustomTerm(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand font-medium bg-white"
                    >
                      <option value="12">1 Year (12 Months)</option>
                      <option value="24">2 Years (24 Months)</option>
                      <option value="36">3 Years (36 Months)</option>
                      <option value="48">4 Years (48 Months)</option>
                      <option value="60">5 Years (60 Months - Maximum)</option>
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={customSubmitting}
                      className="w-full sm:flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl shadow-md transition disabled:opacity-60 text-sm flex items-center justify-center"
                    >
                      {customSubmitting ? 'Submitting Request...' : 'Submit Acquisition Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomModalOpen(false)}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
