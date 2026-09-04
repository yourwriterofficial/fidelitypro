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
    // Prevent double-initialisation (e.g. React StrictMode double-mount).
    // We use authSubscription as the canonical guard because isInitializing
    // resets in finally{} while the async work is still in flight.
    if (authSubscription) return;
    if (isInitializing) return;
    isInitializing = true;

    try {
      // ── Step 1: Subscribe to auth state changes FIRST ────────────────────
      // We wire up the listener before calling getSession() so we never miss
      // the INITIAL_SESSION event that Supabase fires on PWA cold-start.
      // INITIAL_SESSION is the authoritative "here is your restored session"
      // event — on a PWA launch it arrives instead of SIGNED_IN.
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

        // Handle every session-bearing event: initial restore, sign-in, token
        // refresh, and profile updates.  INITIAL_SESSION is the critical one
        // that was previously missing — it is what Supabase fires when a PWA
        // is relaunched from the home screen and the session is restored from
        // localStorage, so without it the user appeared to be logged out.
        if (
          (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' ||
           event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
          session?.user
        ) {
          const profile = await fetchProfile(session.user.id);
          saveCache(session.user, profile);
          set({
            user: session.user,
            profile,
            isAdmin: profile?.is_admin || false,
            loading: false,
          });
          return;
        }

        // INITIAL_SESSION with a null session means the user is genuinely
        // signed out (no stored session exists). Clear state only then.
        if (event === 'INITIAL_SESSION' && !session) {
          clearCache();
          set({ user: null, profile: null, isAdmin: false, loading: false });
        }
      });
      authSubscription = subscription;

      // ── Step 2: Eagerly resolve from getSession() for fast first paint ───
      // This runs *after* we've set up the listener, so there is no race.
      // If it returns a valid session we update state immediately (before the
      // INITIAL_SESSION event fires) so the UI doesn't flash a loading state.
      // If it returns null we do NOT clear auth — we wait for the listener's
      // INITIAL_SESSION event to be authoritative.  This prevents the common
      // PWA false-logout where getSession() resolves before Supabase has had
      // a chance to restore the session from localStorage on a cold start.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        // A transient network / storage error — don't log the user out.
        // The auth listener will deliver the correct state when it recovers.
        console.warn('Session retrieval error (non-fatal):', sessionError);
        // Only mark loading done if we have nothing cached; otherwise keep the
        // cached state visible until the listener resolves.
        if (!getCachedUser()) set({ loading: false });
        return;
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
        // If session is null and there is no cached user, unblock loading immediately
        // so public pages (landing, pricing, login) load instantly without a delay or watchdog wait.
        if (!getCachedUser()) {
          set({ loading: false });
        }
      }
    } catch (error) {
      console.error('Auth init error:', error);
      // Don't log out the user on an unexpected error — just unblock the UI.
      if (!getCachedUser()) set({ loading: false });
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