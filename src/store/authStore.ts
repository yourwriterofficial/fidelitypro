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
  can_withdraw: boolean;
  can_invest: boolean;
  can_stake: boolean;
  can_property: boolean;
  restriction_reason: string;
  fee_required: number;
  kyc_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  kyc_level?: number;
  can_translate?: boolean;
  browser_language?: string;
  preferred_translation_lang?: string;
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

export const PROFILE_CACHE_KEY = 'rpm_cached_profile';
export const USER_CACHE_KEY = 'rpm_cached_user';

export const getCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getCachedProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveCache = (user: User | null, profile: Profile | null) => {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
};

export const clearCache = () => {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore
  }
};

export const fetchProfileWithTimeout = async (
  userId: string,
  fallbackProfile?: Profile | null,
  timeoutMs: number = 2500
): Promise<Profile | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timer);

    if (error) {
      if (error.code !== 'PGRST116') {
        console.warn('Profile fetch warning (using fallback):', error.message || error);
      }
      return fallbackProfile || getCachedProfile();
    }
    return data || fallbackProfile || getCachedProfile();
  } catch (err) {
    console.warn('Network profile fetch error (using fallback):', err);
    return fallbackProfile || getCachedProfile();
  }
};

export const fetchProfile = (userId: string, fallbackProfile?: Profile | null) =>
  fetchProfileWithTimeout(userId, fallbackProfile, 2500);

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
      const cached = get().profile || getCachedProfile();
      saveCache(data.user, cached);
      const profile = await fetchProfileWithTimeout(data.user.id, cached, 2000);
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
      const cached = get().profile || getCachedProfile();
      saveCache(data.user, cached);
      const profile = await fetchProfileWithTimeout(data.user.id, cached, 2000);
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
    // Prevent double-initialisation (e.g. React StrictMode double-mount).
    if (authSubscription) return;
    if (isInitializing) return;
    isInitializing = true;

    try {
      // ── Step 1: Subscribe to auth state changes ────────────────────────
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const { isImpersonating } = get();
        if (isImpersonating) return;

        if (event === 'SIGNED_OUT') {
          clearCache();
          set({
            user: null,
            profile: null,
            isAdmin: false,
            loading: false,
            isImpersonating: false,
            originalUser: null,
            originalProfile: null,
          });
          return;
        }

        // Handle every session-bearing event synchronously to prevent Web Lock deadlocks
        if (
          (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' ||
           event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
          session?.user
        ) {
          const cachedProfile = get().profile || getCachedProfile();
          saveCache(session.user, cachedProfile);
          set({
            user: session.user,
            profile: cachedProfile,
            isAdmin: cachedProfile?.is_admin || false,
            loading: false,
          });

          // Defer subsequent database query via setTimeout(0) to release Navigator Lock first!
          setTimeout(async () => {
            try {
              const freshProfile = await fetchProfileWithTimeout(session.user.id, cachedProfile, 2500);
              if (freshProfile) {
                saveCache(session.user, freshProfile);
                set({
                  profile: freshProfile,
                  isAdmin: freshProfile.is_admin || false,
                });
              }
            } catch (err) {
              console.warn('Background profile sync warning:', err);
            }
          }, 0);
          return;
        }

        // INITIAL_SESSION with a null session: unblock immediately
        if (event === 'INITIAL_SESSION' && !session) {
          clearCache();
          set({ user: null, profile: null, isAdmin: false, loading: false });
        }
      });
      authSubscription = subscription;

      // ── Step 2: Eagerly resolve from getSession() ───────────────────────
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn('Session retrieval error (non-fatal):', sessionError);
        set({ loading: false });
        return;
      }

      if (session?.user) {
        const cachedProfile = get().profile || getCachedProfile();
        saveCache(session.user, cachedProfile);
        set({
          user: session.user,
          profile: cachedProfile,
          isAdmin: cachedProfile?.is_admin || false,
          loading: false,
        });

        // Background update without blocking initial render
        fetchProfileWithTimeout(session.user.id, cachedProfile, 2500).then((freshProfile) => {
          if (freshProfile) {
            saveCache(session.user, freshProfile);
            set({
              profile: freshProfile,
              isAdmin: freshProfile.is_admin || false,
            });
          }
        }).catch(() => {});
      } else {
        clearCache();
        set({ user: null, profile: null, isAdmin: false, loading: false });
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
      const cachedProfile = get().profile || getCachedProfile();
      const profile = await fetchProfileWithTimeout(user.id, cachedProfile, 2500);
      if (profile) {
        saveCache(user, profile);
        set({ profile, isAdmin: profile.is_admin || false });
      }
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
