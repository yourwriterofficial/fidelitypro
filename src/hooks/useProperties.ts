import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { notifyAdmins, notifyUser } from '../lib/notify';
import type { 
  Property, 
  CustomPropertyRequest, 
  PropertyInvestment, 
  PropertyCategoryTab, 
  PropertyFilterState 
} from '../types/property';

const initialFilters: PropertyFilterState = {
  searchQuery: '',
  minPrice: '',
  maxPrice: '',
  minBeds: '',
  minBaths: '',
  carTrans: '',
  carFuel: '',
};

export function useProperties() {
  const { profile } = useAuthStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [myInvestments, setMyInvestments] = useState<PropertyInvestment[]>([]);
  const [myCustomRequests, setMyCustomRequests] = useState<CustomPropertyRequest[]>([]);

  // Navigation & Filtering
  const [selectedTab, setSelectedTab] = useState<PropertyCategoryTab>('House');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<PropertyFilterState>(initialFilters);

  // Likes Tracking
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);

  // Submission State
  const [submittingInvest, setSubmittingInvest] = useState(false);
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);

  // ── DATA FETCHING ──────────────────────────────────────────────────────────
  const fetchProperties = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .in('status', ['active', 'sold']);

      if (error) {
        toast.error('Failed to load properties');
        return;
      }

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
    } catch (err) {
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyInvestments = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('property_investments')
        .select('*, property:property_id(title)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyInvestments(data as PropertyInvestment[]);
      }
    } catch (err) {
      console.warn('Failed loading investments:', err);
    }
  }, [profile]);

  const fetchMyCustomRequests = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('custom_property_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyCustomRequests(data as CustomPropertyRequest[]);
      }
    } catch (err) {
      console.warn('Failed loading custom property requests:', err);
    }
  }, [profile]);

  const fetchScrollSpeed = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'property_scroll_speed')
        .single();

      if (!error && data) {
        setScrollSpeed(parseInt(data.value, 10) || 3);
      }
    } catch (err) {
      console.warn('Failed loading scroll speed setting:', err);
    }
  }, []);

  const fetchLikes = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('property_likes')
        .select('property_id')
        .eq('user_id', profile.id);

      if (data) {
        setLikedIds(new Set(data.map((r: any) => r.property_id)));
      }
    } catch (err) {
      console.warn('Failed loading likes:', err);
    }
  }, [profile]);

  useEffect(() => {
    fetchProperties();
    fetchMyInvestments();
    fetchMyCustomRequests();
    fetchScrollSpeed();
    fetchLikes();
  }, [fetchProperties, fetchMyInvestments, fetchMyCustomRequests, fetchScrollSpeed, fetchLikes]);

  // ── LIKES MUTATION ─────────────────────────────────────────────────────────
  const handleLike = async (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    if (!profile) {
      toast.error('Please log in to like listings.');
      return;
    }
    if (likedIds.has(propertyId)) {
      toast('You already saved this asset to favorites! ❤️', {
        description: 'Each listing can only be marked once per investor account.',
      });
      return;
    }

    setLikingId(propertyId);
    try {
      const { error: likeErr } = await supabase
        .from('property_likes')
        .insert({ user_id: profile.id, property_id: propertyId });

      if (likeErr) throw likeErr;

      await supabase.rpc('increment_likes', { row_id: propertyId });

      setLikedIds((prev) => new Set([...prev, propertyId]));
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, interested_count: (p.interested_count || 0) + 1 }
            : p
        )
      );
      toast.success('Saved to Favorites! ❤️', { description: 'Your interest has been recorded on this deed.' });
    } catch (err: any) {
      if (err?.code === '23505') {
        setLikedIds((prev) => new Set([...prev, propertyId]));
        toast('You already saved this asset! ❤️');
      } else {
        toast.error('Could not record like. Try again.');
      }
    } finally {
      setLikingId(null);
    }
  };

  // ── INVESTMENT SUBMISSION ──────────────────────────────────────────────────
  const handleInvestSubmit = async (
    property: Property,
    amount: number,
    termMonths: number
  ) => {
    if (!profile) return;
    if (amount <= 0) {
      toast.error('Enter a valid investment amount');
      return;
    }
    if (amount > (profile.wallet_balance || 0)) {
      toast.error('Insufficient wallet balance');
      return;
    }

    setSubmittingInvest(true);
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount });

      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'investment',
        amount: -amount,
        description: `Property Investment: ${property.title}`,
        status: 'completed',
      });

      const downPaymentRequired = property.price * (property.down_payment_percent / 100);
      const remaining = Math.max(0, property.price - amount);
      const monthlyPaymentVal = parseFloat((remaining / termMonths).toFixed(2));

      const { error } = await supabase.from('property_investments').insert({
        user_id: profile.id,
        property_id: property.id,
        amount_paid: amount,
        remaining_balance: remaining,
        down_payment_paid: amount >= downPaymentRequired,
        status: amount >= downPaymentRequired ? 'active' : 'pending',
        term_months: termMonths,
        monthly_payment: monthlyPaymentVal,
      });

      if (error) throw error;

      const userName = profile?.name || profile?.email || 'Investor';
      notifyAdmins({
        title: `[Property Deed] ${userName} ($${amount.toLocaleString()})`,
        message: `${userName} invested $${amount.toLocaleString()} in ${property.title} (${termMonths} Months).`,
        type: 'alert',
        link: '/admin/properties',
      });

      notifyUser({
        userId: profile.id,
        title: 'Property Deed Investment Confirmed',
        message: `You invested $${amount.toLocaleString()} in ${property.title} (${termMonths} Months). Your fractional deed equity is recorded!`,
        type: 'success',
        link: '/app/properties',
      });

      toast.success('Investment Recorded Successfully!', {
        description: `Fractional deed equity allocated for ${property.title}.`,
      });

      await fetchMyInvestments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete investment');
      throw err;
    } finally {
      setSubmittingInvest(false);
    }
  };

  // ── CUSTOM ACQUISITION REQUEST SUBMISSION ───────────────────────────────────
  const handleCustomRequestSubmit = async (data: {
    category: 'House' | 'Car';
    url: string;
    location: string;
    price: number;
    isResident: boolean;
    beginImmediate: boolean;
    termMonths: number;
  }) => {
    if (!profile) {
      toast.error('Please log in to submit a custom purchase request.');
      return;
    }

    const upfrontDeposit = data.price * 0.20;
    const remaining = Math.max(0, data.price - upfrontDeposit);
    const monthlyPayment = remaining / data.termMonths;

    setSubmittingCustom(true);
    try {
      const { error } = await supabase.from('custom_property_requests').insert({
        user_id: profile.id,
        user_name: profile.name,
        user_email: profile.email,
        category: data.category,
        external_url: data.url,
        location: data.location,
        total_price: data.price,
        upfront_deposit: upfrontDeposit,
        is_national_or_resident: data.isResident,
        begin_documentation_immediately: data.beginImmediate,
        term_months: data.termMonths,
        monthly_payment: monthlyPayment,
        status: 'pending',
      });

      if (error) throw error;

      try {
        await supabase.from('messages').insert({
          user_id: profile.id,
          sender_id: profile.id,
          body: `[Custom ${data.category} Acquisition Request] Link: ${data.url} | Location: ${data.location} | Total Cost: $${data.price.toLocaleString()} | 20% Deposit: $${upfrontDeposit.toLocaleString()} | Term: ${data.termMonths} Months ($${monthlyPayment.toFixed(2)}/mo) | National/Resident: ${data.isResident ? 'YES' : 'NO'} | Immediate Documentation: ${data.beginImmediate ? 'YES' : 'NO'}`,
          read: false,
        });
      } catch (_) {}

      const userName = profile?.name || profile?.email || 'Investor';
      notifyAdmins({
        title: `[Property Request] ${userName}`,
        message: `${userName} submitted a custom ${data.category} request ($${data.price.toLocaleString()} total, $${upfrontDeposit.toLocaleString()} deposit).`,
        type: 'alert',
        link: '/admin/properties',
      });

      notifyUser({
        userId: profile.id,
        title: 'Custom Property Request Received',
        message: `Your custom ${data.category} acquisition request ($${data.price.toLocaleString()} total, $${upfrontDeposit.toLocaleString()} deposit) was received.`,
        type: 'info',
        link: '/app/properties',
      });

      toast.success('Custom Acquisition Request Received!', {
        description: 'Please deposit the 20% upfront sum into your RPM Wallet and upload KYC details in Settings.',
      });

      setCustomSuccess(true);
      await fetchMyCustomRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
      throw err;
    } finally {
      setSubmittingCustom(false);
    }
  };

  // ── FILTERING & COMPUTED COUNTS ────────────────────────────────────────────
  const { houseCount, carCount } = useMemo(() => {
    let houses = 0;
    let cars = 0;
    for (const p of properties) {
      if (p.category === 'Car') cars++;
      else houses++;
    }
    return { houseCount: houses, carCount: cars };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 1. Tab check
      if (selectedTab === 'Car') {
        if (p.category !== 'Car') return false;
      } else {
        if (p.category === 'Car') return false;
      }

      // 2. Search query check
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchLoc = (p.location || '').toLowerCase().includes(q);
        const matchMake = (p.make || '').toLowerCase().includes(q);
        const matchModel = (p.car_model || '').toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchMake && !matchModel && !matchDesc) return false;
      }

      // 3. Price check
      if (filters.minPrice && p.price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && p.price > parseFloat(filters.maxPrice)) return false;

      // 4. Feature checks
      if (selectedTab === 'House') {
        if (filters.minBeds && (p.beds || 0) < parseInt(filters.minBeds, 10)) return false;
        if (filters.minBaths && (p.baths || 0) < parseFloat(filters.minBaths)) return false;
      } else {
        if (filters.carTrans && p.transmission !== filters.carTrans) return false;
        if (filters.carFuel && p.fuel_type !== filters.carFuel) return false;
      }

      return true;
    });
  }, [properties, selectedTab, filters]);

  const itemsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / itemsPerPage));
  const paginatedProperties = useMemo(() => {
    return filteredProperties.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredProperties, currentPage, itemsPerPage]);

  const handleFilterChange = <K extends keyof PropertyFilterState>(
    key: K,
    value: PropertyFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    filters.searchQuery ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBeds ||
    filters.minBaths ||
    filters.carTrans ||
    filters.carFuel
  );

  return {
    properties,
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
  };
}
