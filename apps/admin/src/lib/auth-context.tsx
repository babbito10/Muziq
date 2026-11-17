'use client';

import { hasPermissions } from '@musicverse/auth';
import type { CurrentUser, LoginResponse, PermissionKey } from '@musicverse/types';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, onSessionExpired } from './api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AdminAuth {
  status: Status;
  user: CurrentUser | null;
  can(...permissions: PermissionKey[]): boolean;
  login(email: string, password: string): Promise<LoginResponse>;
  completeMfa(mfaToken: string, code: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AdminAuth | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const started = useRef(false);

  const signIn = useCallback((next: CurrentUser) => {
    setUser(next);
    setStatus('authenticated');
  }, []);
  const signOut = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onSessionExpired(signOut);
    (async () => {
      try {
        if (await api.auth.refresh()) signIn(await api.users.me());
        else signOut();
      } catch {
        signOut();
      }
    })();
  }, [signIn, signOut]);

  const value = useMemo<AdminAuth>(
    () => ({
      status,
      user,
      // UI convenience only — every admin endpoint enforces permissions server-side.
      can: (...permissions) => !!user && hasPermissions(user.roles, permissions),
      login: async (email, password) => {
        const result = await api.auth.login({ email, password });
        if (!result.mfaRequired) signIn(result.user);
        return result;
      },
      completeMfa: async (mfaToken, code) => {
        signIn((await api.auth.verifyMfa({ mfaToken, code })).user);
      },
      logout: async () => {
        await api.auth.logout().catch(() => undefined);
        signOut();
      },
    }),
    [status, user, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth(): AdminAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
