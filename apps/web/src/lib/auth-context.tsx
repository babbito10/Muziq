'use client';

import { isApiError } from '@musicverse/api-client';
import type { CurrentUser, LoginResponse } from '@musicverse/types';
import type { LoginInput, RegisterInput } from '@musicverse/validation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, onSessionExpired } from './api';
import { applyTheme } from './theme';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: CurrentUser | null;
  login(input: Omit<LoginInput, 'clientType'>): Promise<LoginResponse>;
  completeMfa(mfaToken: string, code: string): Promise<void>;
  register(input: Omit<RegisterInput, 'clientType'>): Promise<void>;
  logout(): Promise<void>;
  /** Replace the cached user (after profile/role changes). */
  setUser(user: CurrentUser): void;
  reload(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const restored = useRef(false);

  const setUser = useCallback((next: CurrentUser) => {
    setUserState(next);
    setStatus('authenticated');
    applyTheme(next.preferences.theme);
  }, []);

  const signOutLocally = useCallback(() => {
    setUserState(null);
    setStatus('anonymous');
  }, []);

  // Restore the session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    onSessionExpired(signOutLocally);
    (async () => {
      try {
        if (await api.auth.refresh()) setUser(await api.users.me());
        else signOutLocally();
      } catch {
        signOutLocally();
      }
    })();
    return () => onSessionExpired(null);
  }, [setUser, signOutLocally]);

  const login = useCallback(
    async (input: Omit<LoginInput, 'clientType'>) => {
      const result = await api.auth.login(input);
      if (!result.mfaRequired) setUser(result.user);
      return result;
    },
    [setUser],
  );

  const completeMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const result = await api.auth.verifyMfa({ mfaToken, code });
      setUser(result.user);
    },
    [setUser],
  );

  const register = useCallback(
    async (input: Omit<RegisterInput, 'clientType'>) => {
      const result = await api.auth.register(input);
      setUser(result.user);
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      // Local sign-out still happens; the server session expires on its own.
      if (!isApiError(error)) throw error;
    }
    signOutLocally();
  }, [signOutLocally]);

  const reload = useCallback(async () => {
    setUser(await api.users.me());
  }, [setUser]);

  const value = useMemo(
    () => ({ status, user, login, completeMfa, register, logout, setUser, reload }),
    [status, user, login, completeMfa, register, logout, setUser, reload],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
