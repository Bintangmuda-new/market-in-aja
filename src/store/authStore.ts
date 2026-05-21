// ============================================================
// Zustand Store: Authentication & User Session
// ============================================================

import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (params: SignUpParams) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSession: (session: any) => void;
}

interface SignUpParams {
  email: string;
  password: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  address: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      set({ isLoading: false });
      return { error: 'Email atau kata sandi tidak valid. Silakan coba lagi.' };
    }

    // Fetch user profile from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      set({ isLoading: false });
      return { error: 'Gagal memuat profil pengguna.' };
    }

    if (profile.status === 'pending') {
      await supabase.auth.signOut();
      set({ isLoading: false });
      return { error: 'Akun Anda sedang menunggu verifikasi dari admin. Harap bersabar.' };
    }

    if (profile.status === 'rejected') {
      await supabase.auth.signOut();
      set({ isLoading: false });
      return { error: 'Akun Anda telah ditolak. Hubungi dukungan Sama-Tani untuk informasi lebih lanjut.' };
    }

    set({
      user: profile,
      session: data.session,
      isAuthenticated: true,
      isLoading: false,
    });

    return {};
  },

  signUp: async (params) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
    });

    if (error) {
      set({ isLoading: false });
      return { error: 'Gagal mendaftar. ' + error.message };
    }

    if (data.user) {
      // Insert profile — status defaults to 'pending' (enforced at DB level)
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        full_name: params.full_name,
        phone_number: params.phone_number,
        role: params.role,
        address: params.address,
        // status: 'pending' is the default
      });

      if (profileError) {
        set({ isLoading: false });
        return { error: 'Gagal menyimpan data profil.' };
      }
    }

    set({ isLoading: false });
    return {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) set({ user: data });
  },

  setSession: (session) => set({ session }),
}));
