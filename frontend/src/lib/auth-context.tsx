import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken } from './api';
import type { Profile } from './types';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  profile: Profile;
}

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (full_name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    const token = getToken();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setProfile(null);
    if (token) {
      api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
  }, []);

  // Session restoration: verify the stored token on app load
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ profile: Profile }>('/auth/me')
      .then((data) => setProfile(data.profile))
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setProfile(data.profile);
  }, []);

  const register = useCallback(async (full_name: string, email: string, password: string, phone?: string) => {
    const body: Record<string, string> = { full_name, email, password };
    if (phone) body.phone = phone;
    const data = await api<AuthResponse>('/auth/register', { method: 'POST', body });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setProfile(data.profile);
  }, []);

  const value = useMemo(
    () => ({ profile, loading, login, register, logout }),
    [profile, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
