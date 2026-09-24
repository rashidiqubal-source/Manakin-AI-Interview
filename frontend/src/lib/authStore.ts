"use client";

import { create } from 'zustand';
import { getMeAPI, signinAPI, signupAPI, signoutAPI, UserProfile } from '@/services/api';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  fetchUser: () => Promise<UserProfile | null>;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: UserProfile; message?: string; error?: string }>;
  signup: (payload: { email: string; password: string; name?: string; role?: 'RECRUITER' | 'APPLICANT' }) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
}

const SESSION_COOKIE_NAME = 'ai_interview_session';

function setClientSessionCookie(active: boolean) {
  if (typeof document !== 'undefined') {
    if (active) {
      document.cookie = `${SESSION_COOKIE_NAME}=true; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    }
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isInitialized: false,

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const user = await getMeAPI();
      setClientSessionCookie(!!user);
      set({ user, isLoading: false, isInitialized: true });
      return user;
    } catch (err) {
      setClientSessionCookie(false);
      set({ user: null, isLoading: false, isInitialized: true });
      return null;
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      const res = await signinAPI({ email, password });
      const user = res.data.user as UserProfile;
      setClientSessionCookie(true);
      set({ user, isLoading: false, isInitialized: true });
      return { success: true, user, message: res.message };
    } catch (err: any) {
      setClientSessionCookie(false);
      set({ isLoading: false });
      const errorMsg = err.response?.data?.message || err.message || 'Failed to sign in';
      return { success: false, error: errorMsg };
    }
  },

  signup: async (payload) => {
    try {
      set({ isLoading: true });
      const res = await signupAPI(payload);
      set({ isLoading: false });
      return { success: true, message: res.message };
    } catch (err: any) {
      set({ isLoading: false });
      const errorMsg = err.response?.data?.message || err.message || 'Failed to sign up';
      return { success: false, error: errorMsg };
    }
  },

  logout: async () => {
    try {
      await signoutAPI();
    } catch {
      // Ignore network errors during signout
    } finally {
      setClientSessionCookie(false);
      set({ user: null, isLoading: false, isInitialized: true });
    }
  },

  setUser: (user) => {
    setClientSessionCookie(!!user);
    set({ user });
  },
}));
