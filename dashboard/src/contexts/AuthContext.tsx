/**
 * Authentication Context
 * Manages user authentication state
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '@/services/api';
import config from '@/lib/config';

interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  is_verified: boolean;
  role: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem(config.tokenKey);
      if (!token) {
        setUser(null);
        return;
      }

      const response = await authApi.getMe();
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
      localStorage.removeItem(config.tokenKey);
      localStorage.removeItem(config.refreshTokenKey);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setUser(response.data.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    username: string;
    first_name?: string;
    last_name?: string;
  }) => {
    await authApi.register(data);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
