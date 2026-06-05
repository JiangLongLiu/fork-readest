'use client';

import {
  createContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getClientVersion } from '@/utils/supabase';
import posthog from 'posthog-js';

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  });
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    }
    return null;
  });

  useEffect(() => {
    const syncSession = (
      session: { access_token: string; refresh_token: string; user: User } | null,
    ) => {
      if (session) {
        console.log('Syncing session');
        const { access_token, refresh_token, user } = session;
        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        posthog.identify(user.id);
        setToken(access_token);
        setUser(user);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    };

    const initAuth = async () => {
      // After Supabase re-initialization (e.g. wizard config change),
      // the new client has no session. Restore it from localStorage tokens
      // so that auto-refresh and onAuthStateChange work correctly.
      const storedToken = localStorage.getItem('token');
      const storedRefresh = localStorage.getItem('refresh_token');
      if (storedToken && storedRefresh) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: storedToken,
            refresh_token: storedRefresh,
          });
          if (error || !data.session) {
            // Stored tokens are invalid (expired refresh token, etc.)
            console.warn('Failed to restore session, clearing tokens');
            syncSession(null);
            return;
          }
          // setSession succeeded — syncSession will be called by onAuthStateChange
        } catch {
          syncSession(null);
          return;
        }
      }

      // Try to refresh the session to ensure we have a fresh access token
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          // No active session or refresh failed
          if (!storedToken) syncSession(null);
        }
      } catch {
        if (!storedToken) syncSession(null);
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_, session) => {
      syncSession(session);
    });

    initAuth();

    return () => {
      subscription?.subscription.unsubscribe();
    };
    // Re-run when the Supabase client is re-initialized (wizard save)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getClientVersion()]);

  // setToken / setUser from useState are stable across renders, so the empty
  // deps array is correct. Wrapping in useCallback (and only including stable
  // refs in the deps) is what makes the useMemo below actually memoize the
  // context value — without this, login/logout/refresh would be recreated on
  // every render and the memo would always invalidate.
  const login = useCallback((newToken: string, newUser: User) => {
    console.log('Logging in');
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    console.log('Logging out');
    try {
      await supabase.auth.refreshSession();
    } catch {
    } finally {
      await supabase.auth.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ token, user, login, logout, refresh }),
    [token, user, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
