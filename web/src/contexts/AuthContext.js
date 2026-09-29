'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api';

/**
 * Session-based auth state.
 *
 * The session lives in an HttpOnly cookie set by the API; this context never
 * sees it. The current user always comes from the API (GET /api/auth/me, or
 * the login/register response), never from decoding a token or reading
 * browser storage.
 *
 * Presence: while the tab is visible, /api/auth/me is re-fetched every
 * PRESENCE_POLL_MS. That doubles as the online heartbeat; the API only
 * writes last_online_at to the database at most every 2 minutes.
 */
const AuthContext = createContext(null);
const PRESENCE_POLL_MS = 60_000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      const next = data?.authenticated ? data.user : null;
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((data) => !cancelled && setUser(data?.authenticated ? data.user : null))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        authApi
          .me()
          .then((data) => setUser(data?.authenticated ? data.user : null))
          .catch(() => {});
      }
    }, PRESENCE_POLL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  const login = useCallback(async ({ username, password }) => {
    const data = await authApi.login({ username, password });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ username, password }) => {
    const data = await authApi.register({ username, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated, refreshUser, login, register, logout }),
    [user, loading, isAuthenticated, refreshUser, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
