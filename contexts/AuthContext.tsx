'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('auth_token', res.data.token);
    }
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Token may already be invalid
    }
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const hasPermission = useCallback((permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  }, [user]);

  const hasRole = useCallback((role: string) => {
    return user?.roles?.includes(role) ?? false;
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission, hasRole }),
    [user, loading, hasPermission, hasRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
