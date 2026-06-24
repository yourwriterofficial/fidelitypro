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

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('Profile fetch error:', error);
    return null;
  }
  return data;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isImpersonating: false,
  originalUser: null,
  originalProfile: null,

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      set({
        user: data.user,
        profile,
        isAdmin: profile?.is_admin || false,
        loading: false,
      });
    }
  },

  signUp: async (email, password, name) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    const needsEmailConfirm = data.user?.identities?.length === 0 || !data.session;
    if (!needsEmailConfirm && data.user) {
      const profile = await fetchProfile(data.user.id);
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
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false, loading: false, isImpersonating: false, originalUser: null, originalProfile: null });
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  initAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        set({
          user: session.user,
          profile,
          isAdmin: profile?.is_admin || false,
          loading: false,
        });
      } else {
        set({ loading: false });
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id);
          set({
            user: session.user,
            profile,
            isAdmin: profile?.is_admin || false,
            loading: false,
          });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, isAdmin: false, loading: false });
        }
      });
    } catch (error) {
      console.error('Auth init error:', error);
      set({ loading: false });
    }
  },

  setLoading: (state) => set({ loading: state }),

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await fetchProfile(user.id);
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