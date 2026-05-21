// ============================================================
// Market-In Aja — Auth Global State (Zustand)
// ============================================================
import { create } from 'zustand';
import { UserProfile } from '@types/index';
import { supabase } from '@lib/supabase/client';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  refreshProfile: async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();

    if (error || !profile) return;
    set({ user: profile as UserProfile, isAuthenticated: true, isLoading: false });
  },
}));
