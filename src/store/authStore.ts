import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
  is_admin: boolean;
  banned: boolean;
  ban_reason?: string;
  referred_by?: string;
  referral_code?: string;
  created_at: string;
  // ⬇️ ADD THESE
  can_withdraw: boolean;
  can_invest: boolean;
  can_stake: boolean;
  can_property: boolean;
  restriction_reason: string;
  fee_required: number;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  originalUser: User | null;
  originalProfile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initAuth: () => Promise<void>;
  setLoading: (state: boolean) => void;
  refreshProfile: () => Promise<void>;
  impersonateUser: (profile: Profile) => void;
  clearImpersonation: () => void;
}

const PROFILE_CACHE_KEY = 'rpm_cached_profile';
const USER_CACHE_KEY = 'rpm_cached_user';

const getCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getCachedProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCache = (user: User | null, profile: Profile | null) => {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);

    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore storage quota errors
  }
};

const clearCache = () => {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore
  }
};

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
      }
      return getCachedProfile();
    }
    return data;
  } catch (err) {
    console.error('Network profile fetch error:', err);
    return getCachedProfile();
  }
};

let authSubscription: { unsubscribe: () => void } | null = null;
let isInitializing = false;

const initialCachedUser = getCachedUser();
const initialCachedProfile = getCachedProfile();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialCachedUser,
  profile: initialCachedProfile,
  loading: !initialCachedUser,
  isAdmin: initialCachedProfile?.is_admin || false,
  isImpersonating: false,
  originalUser: null,
  originalProfile: null,

  signIn: async (email, password) => {
    set({ loading: true });
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      set({ loading: false });
      throw error;
    }
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      saveCache(data.user, profile);
      set({
        user: data.user,
        profile,
        isAdmin: profile?.is_admin || false,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  signUp: async (email, password, name) => {
    set({ loading: true });
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) {
      set({ loading: false });
      throw error;
    }
    const needsEmailConfirm = data.user?.identities?.length === 0 || !data.session;
    if (!needsEmailConfirm && data.user) {
      const profile = await fetchProfile(data.user.id);
      saveCache(data.user, profile);
      set({
        user: data.user,
        profile,
        isAdmin: profile?.is_admin || false,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
    return { needsEmailConfirm };
  },

  signOut: async () => {
    clearCache();
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false, loading: false, isImpersonating: false, originalUser: null, originalProfile: null });
  },

  resetPassword: async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  initAuth: async () => {
    if (isInitializing) return;
    isInitializing = true;

    try {
      // 1. Get initial session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Session retrieval error:', sessionError);
      }

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        saveCache(session.user, profile);
        set({
          user: session.user,
          profile,
          isAdmin: profile?.is_admin || false,
          loading: false,
        });
      } else {
        // If no session exists from Supabase, only clear if we are not actively in an impersonation state
        const { isImpersonating } = get();
        if (!isImpersonating) {
          clearCache();
          set({ user: null, profile: null, isAdmin: false, loading: false });
        }
      }

      // 2. Set up single persistent auth listener
      if (!authSubscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          const { isImpersonating } = get();
          if (isImpersonating) return;

          if (event === 'SIGNED_OUT') {
            // Double-check session to prevent transient logout spikes
            const { data: currentCheck } = await supabase.auth.getSession();
            if (!currentCheck?.session) {
              clearCache();
              set({ user: null, profile: null, isAdmin: false, loading: false,
                    isImpersonating: false, originalUser: null, originalProfile: null });
            }
            return;
          }

          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
            const profile = await fetchProfile(session.user.id);
            saveCache(session.user, profile);
            set({
              user: session.user,
              profile,
              isAdmin: profile?.is_admin || false,
              loading: false,
            });
          }
        });
        authSubscription = subscription;
      }
    } catch (error) {
      console.error('Auth init error:', error);
      set({ loading: false });
    } finally {
      isInitializing = false;
    }
  },

  setLoading: (state) => set({ loading: state }),

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await fetchProfile(user.id);
      saveCache(user, profile);
      set({ profile, isAdmin: profile?.is_admin || false });
    }
  },

  impersonateUser: (profile: Profile) => {
    const { user, profile: currentProfile } = get();
    set({
      originalUser: user,
      originalProfile: currentProfile,
      isImpersonating: true,
      user: { ...user, id: profile.id } as User,
      profile,
      isAdmin: profile.is_admin,
    });
  },

  clearImpersonation: () => {
    const { originalUser, originalProfile } = get();
    set({
      user: originalUser,
      profile: originalProfile,
      isAdmin: originalProfile?.is_admin || false,
      isImpersonating: false,
      originalUser: null,
      originalProfile: null,
    });
  },
}));