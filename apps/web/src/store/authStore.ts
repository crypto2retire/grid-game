import { create } from 'zustand';
import { fetchApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  wallet?: {
    cash: number;
    dynTokens: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const data = await fetchApi('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ user: data.data, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export async function login(email: string, password: string) {
  const data = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setAuth(data.data.user, data.data.token);
  return data.data;
}

export async function register(email: string, username: string, password: string, displayName?: string) {
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, displayName }),
  });
  useAuthStore.getState().setAuth(data.data.user, data.data.token);
  return data.data;
}
