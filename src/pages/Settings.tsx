import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import {
  User, Mail, Lock, Save, Eye, EyeOff, Shield, Bell,
  ShieldCheck, AlertCircle, Clock, Upload, CheckCircle2,
  XCircle, RefreshCw, Smartphone, Trash2
} from 'lucide-react';
import { notifyAdmins, notifyAdminsWithEmail } from '../lib/notify';

interface KYCData {
  id?: string;
  first_name: string;
  last_name: string;
  dob: string;
  nationality: string;
  document_type: 'passport' | 'national_id' | 'drivers_license';
  document_number: string;
  document_front_url: string;
  document_back_url?: string;
  selfie_url?: string;
  residential_address: string;
  city: string;
  country: string;
  postal_code: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at?: string;
  reviewed_at?: string;
}

export default function Settings() {
  const { profile, refreshProfile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'kyc' | 'security' | 'notifications'>(
    (initialTab as any) || 'profile'
  );

  // Profile Information
  const [name, setName] = useState(profile?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password & Security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    email_info: true,
    email_warning: true,
    email_success: true,
    email_alert: true,
    push_info: true,
    push_warning: true,
    push_success: true,
    push_alert: true,
  });

  const [lockedNotifications, setLockedNotifications] = useState<Record<string, boolean>>({
    email_info: false,
    email_success: false,
    email_warning: true,
    email_alert: true,
    push_info: false,
    push_success: false,
    push_warning: true,
    push_alert: true,
  });

  const [devices, setDevices] = useState<any[]>([]);

  // KYC State
  const [kycRecord, setKycRecord] = useState<KYCData | null>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // KYC Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [documentType, setDocumentType] = useState<'passport' | 'national_id' | 'drivers_license'>('passport');
  const [documentNumber, setDocumentNumber] = useState('');
  const [frontUrl, setFrontUrl] = useState('');
  const [backUrl, setBackUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'kyc', 'security', 'notifications'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabChange = (t: 'profile' | 'kyc' | 'security' | 'notifications') => {
    setActiveTab(t);
    setSearchParams({ tab: t });
  };

  const fetchKYCRecord = async () => {
    if (!profile?.id) return;
    setKycLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setKycRecord(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setDob(data.dob || '');
        setNationality(data.nationality || '');
        setDocumentType(data.document_type || 'passport');
        setDocumentNumber(data.document_number || '');
        setFrontUrl(data.document_front_url || '');
        setBackUrl(data.document_back_url || '');
        setSelfieUrl(data.selfie_url || '');
        setAddress(data.residential_address || '');
        setCity(data.city || '');
        setCountry(data.country || '');
        setPostalCode(data.postal_code || '');
      }
    } catch (err) {
      console.error('Error fetching KYC:', err);
    } finally {
      setKycLoading(false);
    }
  };

  const fetchPreferences = async () => {
    if (!profile?.id) return;
    try {
      const [prefRes, lockRes] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'locked_notifications')
          .maybeSingle(),
      ]);

      let activeLocked = {
        email_info: false,
        email_success: false,
        email_warning: true,
        email_alert: true,
        push_info: false,
        push_success: false,
        push_warning: true,
        push_alert: true,
      };

      if (lockRes?.data?.value) {
        try {
          activeLocked = JSON.parse(lockRes.data.value);
          setLockedNotifications(activeLocked);
        } catch (e) {
          console.error('Failed parsing locked notifications settings', e);
        }
      }

      if (prefRes?.error) {
        if (prefRes.error.code === 'PGRST116') {
          const defaults = {
            user_id: profile.id,
            email_info: true,
            email_warning: true,
            email_success: true,
            email_alert: true,
            push_info: true,
            push_warning: true,
            push_success: true,
            push_alert: true,
          };
          await supabase.from('notification_preferences').insert(defaults);
          setPreferences(defaults);
        }
      } else if (prefRes?.data) {
        const mergedPrefs = { ...prefRes.data };
        Object.keys(activeLocked).forEach((key) => {
          if (activeLocked[key as keyof typeof activeLocked] === true) {
            mergedPrefs[key] = true;
          }
        });
        setPreferences(mergedPrefs);
      }

      const subsRes = await supabase
        .from('push_subscriptions')
        .select('id, user_agent, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!subsRes.error) {
        setDevices(subsRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching preferences & devices:', err);
    }
  };

  useEffect(() => {
    fetchPreferences();
    fetchKYCRecord();
  }, [profile?.id]);

  const handleFileUpload = async (file: File, type: 'front' | 'back' | 'selfie') => {
    if (!profile?.id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    if (type === 'front') setUploadingFront(true);
    if (type === 'back') setUploadingBack(true);
    if (type === 'selfie') setUploadingSelfie(true);

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${profile.id}/${type}_${Date.now()}.${fileExt}`;

      // Upload to supabase storage
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, { upsert: true });

      if (error) {
        // Fallback to base64 preview if bucket upload is blocked
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (type === 'front') setFrontUrl(base64);
          if (type === 'back') setBackUrl(base64);
          if (type === 'selfie') setSelfieUrl(base64);
          toast.success(`${type.toUpperCase()} document attached!`);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(data.path);

      const url = publicUrlData.publicUrl;
      if (type === 'front') setFrontUrl(url);
      if (type === 'back') setBackUrl(url);
      if (type === 'selfie') setSelfieUrl(url);
      toast.success(`${type.toUpperCase()} document uploaded successfully!`);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      if (type === 'front') setUploadingFront(false);
      if (type === 'back') setUploadingBack(false);
      if (type === 'selfie') setUploadingSelfie(false);
    }
  };

  const handleKYCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!frontUrl) {
      toast.error('Please upload the front image of your ID / Passport');
      return;
    }
    if (!agreeTerms) {
      toast.error('Please accept the accuracy and anti-fraud declaration');
      return;
    }

    setKycSubmitting(true);
    try {
      const kycPayload = {
        user_id: profile.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob,
        nationality,
        document_type: documentType,
        document_number: documentNumber.trim(),
        document_front_url: frontUrl,
        document_back_url: backUrl || null,
        selfie_url: selfieUrl || null,
        residential_address: address,
        city,
        country,
        postal_code: postalCode,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabase
        .from('kyc_verifications')
        .insert(kycPayload);

      if (insertErr) throw insertErr;

      // Update user profile kyc_status
      await supabase
        .from('profiles')
        .update({ kyc_status: 'pending' })
        .eq('id', profile.id);

      await refreshProfile();
      await fetchKYCRecord();
      setIsResubmitting(false);
      toast.success('Identity Verification submitted! Compliance will review within 15–30 minutes.');

      const userName = `${firstName} ${lastName}`.trim() || profile?.name || profile?.email || 'Investor';
      notifyAdmins({
        title: `[KYC Submitted] ${userName}`,
        message: `${userName} submitted Level 1 Identity Verification (${documentType.toUpperCase()}: ${documentNumber}).`,
        type: 'alert',
        link: '/admin/kyc',
      });

      notifyAdminsWithEmail(
        `[RPM] New KYC Submission: ${userName}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #00674F;">New KYC Identity Verification</h2>
            <p><strong>User:</strong> ${userName} (${profile.email})</p>
            <p><strong>Document Type:</strong> ${documentType.toUpperCase()}</p>
            <p><strong>Document Number:</strong> ${documentNumber}</p>
            <p><strong>Nationality:</strong> ${nationality || 'N/A'}</p>
            <p style="margin-top: 24px;">
              <a href="${window.location.origin}/admin/kyc" style="background: #00674F; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Review KYC Documents
              </a>
            </p>
          </div>
        `
      );
    } catch (err: any) {
      console.error('KYC submission error:', err);
      toast.error(err.message || 'Failed to submit KYC verification');
    } finally {
      setKycSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setProfileLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSecurityLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSecurityLoading(false); }
  };

  const handleTogglePreference = async (key: keyof typeof preferences) => {
    if (!profile?.id) return;
    if (lockedNotifications[key] === true) {
      toast.error('This notification setting is locked by the administrator.');
      return;
    }
    const newVal = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newVal }));
    
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: newVal })
        .eq('user_id', profile.id);
        
      if (error) throw error;
      toast.success('Notification preferences updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preferences');
      setPreferences(prev => ({ ...prev, [key]: !newVal }));
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success('Device push registration revoked.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke device registration.');
    }
  };

  const initials = (profile?.name || profile?.email || 'U')
    .split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');

  const kycStatus = profile?.kyc_status || kycRecord?.status || 'unverified';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
            Account Management & Security
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Account Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure profile info, identity verification (KYC), security credentials, and alerts.
          </p>
        </div>

        {/* KYC Status Pill */}
        <div className="shrink-0">
          {kycStatus === 'verified' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 text-brand border border-emerald-200 font-bold text-xs">
              <CheckCircle2 size={15} /> Level 1 Verified
            </span>
          )}
          {kycStatus === 'pending' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
              <Clock size={15} className="animate-spin" /> Verification Pending
            </span>
          )}
          {kycStatus === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-red-50 text-red-700 border border-red-200 font-bold text-xs">
              <XCircle size={15} /> Action Required
            </span>
          )}
          {kycStatus === 'unverified' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs">
              <Shield size={14} /> Unverified (Level 0)
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1">
        {[
          { key: 'profile',       label: 'Profile',         icon: User },
          { key: 'kyc',           label: 'Identity (KYC)',  icon: ShieldCheck },
          { key: 'security',      label: 'Security & 2FA',  icon: Lock },
          { key: 'notifications', label: 'Notifications',   icon: Bell },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key as any)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
              {t.key === 'kyc' && kycStatus === 'pending' && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: PROFILE ── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-brand text-white text-2xl font-extrabold rounded-2xl flex items-center justify-center shadow-md">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{profile?.name || 'Investor'}</h2>
                <p className="text-xs text-gray-400">{profile?.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                    ID: #{profile?.id.substring(0, 8)}
                  </span>
                  {profile?.is_admin && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Administrator
                    </span>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    placeholder="Your full legal or display name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Registered Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-xs bg-gray-50 text-gray-400 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-2xl text-xs font-bold transition shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {profileLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 2: IDENTITY VERIFICATION (KYC) ── */}
      {activeTab === 'kyc' && (
        <div className="space-y-6">
          {/* Level Comparison Hero Card */}
          <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  Bybit-Grade Identity Protection
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Level 1 Individual Identity Verification
                </h2>
                <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
                  Required for fractional real estate deed conveyance, legal contract title issuance, unlimited fixed-yield staking, and high-tier withdrawals.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs space-y-2 min-w-56">
                <div className="flex justify-between items-center text-gray-300">
                  <span>Daily Withdrawal:</span>
                  <span className="font-bold text-white">$1,000,000</span>
                </div>
                <div className="flex justify-between items-center text-gray-300">
                  <span>Property Conveyance:</span>
                  <span className="font-bold text-emerald-400">Unlocked</span>
                </div>
                <div className="flex justify-between items-center text-gray-300">
                  <span>P2P Express Desk:</span>
                  <span className="font-bold text-white">0% Fee Tier</span>
                </div>
              </div>
            </div>
          </div>

          {kycLoading ? (
            <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm space-y-4 animate-pulse">
              <div className="h-10 bg-gray-100 rounded-2xl w-2/3" />
              <div className="h-32 bg-gray-50 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* STATUS VIEW 1: VERIFIED */}
              {kycStatus === 'verified' && !isResubmitting && (
            <div className="bg-white rounded-3xl border border-emerald-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4 bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200">
                <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shadow-md">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">
                    Identity Verified (Level 1 Active)
                  </h3>
                  <p className="text-xs text-brand font-semibold mt-0.5">
                    Your account is fully compliant. All investment limits and legal deeds are available.
                  </p>
                </div>
              </div>

              {kycRecord && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Legal Name</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{kycRecord.first_name} {kycRecord.last_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Document Type</span>
                    <span className="font-bold text-gray-900 uppercase block mt-0.5">{kycRecord.document_type.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Document Number</span>
                    <span className="font-mono font-bold text-gray-900 block mt-0.5">{kycRecord.document_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Nationality</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{kycRecord.nationality || 'Verified'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUS VIEW 2: PENDING REVIEW */}
          {kycStatus === 'pending' && !isResubmitting && (
            <div className="bg-white rounded-3xl border border-amber-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4 bg-amber-50/70 p-5 rounded-2xl border border-amber-200">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <Clock size={24} className="animate-spin" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">
                    Documents Under Compliance Review
                  </h3>
                  <p className="text-xs text-amber-800 font-semibold mt-0.5">
                    Estimated turnaround time: <strong>15–30 minutes</strong>. Our compliance officers are verifying your document authenticity.
                  </p>
                </div>
              </div>

              {kycRecord && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Submitted Name:</span>
                    <span className="font-bold text-gray-900">{kycRecord.first_name} {kycRecord.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Document:</span>
                    <span className="font-bold text-gray-900 uppercase">{kycRecord.document_type.replace('_', ' ')} ({kycRecord.document_number})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Submission Date:</span>
                    <span className="font-bold text-gray-900">{new Date(kycRecord.submitted_at || '').toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUS VIEW 3: REJECTED NOTICE */}
          {kycStatus === 'rejected' && !isResubmitting && (
            <div className="bg-white rounded-3xl border border-red-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4 bg-red-50 p-5 rounded-2xl border border-red-200">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-red-950">
                    Verification Needs Correction
                  </h3>
                  <p className="text-xs text-red-800 mt-1 font-medium leading-relaxed">
                    Reason: <strong>{kycRecord?.rejection_reason || 'Document image was unreadable or details did not match.'}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsResubmitting(true)}
                className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Re-Submit Verification Documents
              </button>
            </div>
          )}

          {/* FORM: UNVERIFIED OR RESUBMITTING */}
          {(kycStatus === 'unverified' || isResubmitting) && (
            <form onSubmit={handleKYCSubmit} className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-extrabold text-gray-900">
                  Individual KYC Verification Form
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Please provide your legal government identity details as shown on your official document.
                </p>
              </div>

              {/* Step 1: Personal Details */}
              <div className="space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand block">
                  1. Personal Identity Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Legal First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="e.g. Alexander"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Legal Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="e.g. Wright"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nationality *</label>
                    <input
                      type="text"
                      required
                      value={nationality}
                      onChange={e => setNationality(e.target.value)}
                      placeholder="e.g. United Kingdom / United States"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Document Selection */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand block">
                  2. Document Information
                </span>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Select Government ID Type *</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'passport', label: 'Passport' },
                      { id: 'national_id', label: 'National ID' },
                      { id: 'drivers_license', label: "Driver's License" },
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDocumentType(d.id as any)}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold border transition ${
                          documentType === d.id
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/20'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Document ID Number *</label>
                  <input
                    type="text"
                    required
                    value={documentNumber}
                    onChange={e => setDocumentNumber(e.target.value)}
                    placeholder="e.g. P12345678 or 987654321"
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-mono font-bold focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
              </div>

              {/* Step 3: Document Upload Dropzones */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand block">
                  3. Upload Verification Documents (Max 10MB)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Front Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Document Front *</label>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center hover:border-brand transition bg-gray-50/50">
                      {frontUrl ? (
                        <div className="space-y-2">
                          <img src={frontUrl} alt="Front" className="h-28 mx-auto object-cover rounded-xl border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setFrontUrl('')}
                            className="text-[10px] text-red-600 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                          <span className="text-xs font-bold text-gray-700 block">
                            {uploadingFront ? 'Uploading...' : 'Choose Front File'}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">PNG, JPG, PDF</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'front')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Back Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Document Back (Optional for Passport)</label>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center hover:border-brand transition bg-gray-50/50">
                      {backUrl ? (
                        <div className="space-y-2">
                          <img src={backUrl} alt="Back" className="h-28 mx-auto object-cover rounded-xl border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setBackUrl('')}
                            className="text-[10px] text-red-600 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                          <span className="text-xs font-bold text-gray-700 block">
                            {uploadingBack ? 'Uploading...' : 'Choose Back File'}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">PNG, JPG</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'back')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Selfie Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Facial Selfie Check</label>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center hover:border-brand transition bg-gray-50/50">
                      {selfieUrl ? (
                        <div className="space-y-2">
                          <img src={selfieUrl} alt="Selfie" className="h-28 mx-auto object-cover rounded-xl border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setSelfieUrl('')}
                            className="text-[10px] text-red-600 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                          <span className="text-xs font-bold text-gray-700 block">
                            {uploadingSelfie ? 'Uploading...' : 'Upload Selfie Photo'}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">Face with ID</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'selfie')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Residential Address */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand block">
                  4. Residential Address
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Street Address *</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="e.g. 14 Kensington High Street"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="London"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Postal / ZIP Code</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={e => setPostalCode(e.target.value)}
                      placeholder="W8 5NP"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      placeholder="United Kingdom"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Declaration Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span>
                    I confirm that the details provided are accurate and the uploaded documents belong to me. I acknowledge that falsified identity claims violate anti-money laundering regulations and result in account termination.
                  </span>
                </label>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={kycSubmitting}
                className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-2xl text-xs shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {kycSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                Submit Level 1 Identity Verification
              </button>
            </form>
          )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 3: SECURITY & PASSWORD ── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ensure your account uses a secure alphanumeric passphrase.</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-2xl text-xs focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-2xl text-xs focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={securityLoading}
                  className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-2xl text-xs font-bold transition shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {securityLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 4: NOTIFICATIONS & DEVICES ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-900">Notification Preferences</h2>
              <p className="text-xs text-gray-400 mt-0.5">Control operational emails and instant push alerts.</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Notifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'email_info', label: 'Support & Announcements', desc: 'Platform updates and messages.' },
                  { key: 'email_success', label: 'Financial Operations', desc: 'Deposits, investments, and yield payouts.' },
                  { key: 'email_warning', label: 'Account Safeguards', desc: 'Login credential changes.' },
                  { key: 'email_alert', label: 'Critical Security Events', desc: 'Mandatory verifications and restriction alerts.' },
                ].map(({ key, label, desc }) => {
                  const isLocked = lockedNotifications[key] === true;
                  const isChecked = preferences[key as keyof typeof preferences];
                  return (
                    <div key={key} className="flex items-start justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <div className="pr-3">
                        <span className="text-xs font-bold text-gray-900 block">{label}</span>
                        <span className="text-[11px] text-gray-500 block mt-0.5">{desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={() => handleTogglePreference(key as any)}
                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Devices Section */}
            {devices.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registered Push Devices</h3>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
                  {devices.map(d => (
                    <div key={d.id} className="p-3.5 flex items-center justify-between bg-white text-xs">
                      <div className="flex items-center gap-2.5">
                        <Smartphone size={16} className="text-gray-400" />
                        <span className="font-mono text-gray-700 truncate max-w-xs">{d.user_agent || 'Mobile Device'}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteDevice(d.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
