import { isApiError } from '@musicverse/api-client';
import type { CurrentUser, LoginResponse } from '@musicverse/types';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onSessionExpired } from './api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface MobileAuth {
  status: Status;
  user: CurrentUser | null;
  login(email: string, password: string): Promise<LoginResponse>;
  completeMfa(mfaToken: string, code: string): Promise<void>;
  register(input: { email: string; password: string; displayName: string }): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<MobileAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);

  const signedIn = useCallback((u: CurrentUser) => {
    setUser(u);
    setStatus('authenticated');
  }, []);
  const signedOut = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    onSessionExpired(signedOut);
    (async () => {
      try {
        if (await api.auth.refresh()) signedIn(await api.users.me());
        else signedOut();
      } catch {
        signedOut();
      }
    })();
    return () => onSessionExpired(null);
  }, [signedIn, signedOut]);

  const value = useMemo<MobileAuth>(
    () => ({
      status,
      user,
      login: async (email, password) => {
        const result = await api.auth.login({ email, password });
        if (!result.mfaRequired) signedIn(result.user);
        return result;
      },
      completeMfa: async (mfaToken, code) => signedIn((await api.auth.verifyMfa({ mfaToken, code })).user),
      register: async (input) => signedIn((await api.auth.register({ ...input, acceptTerms: true })).user),
      logout: async () => {
        try {
          await api.auth.logout();
        } catch (error) {
          if (!isApiError(error)) throw error;
        }
        signedOut();
      },
    }),
    [status, user, signedIn, signedOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): MobileAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
