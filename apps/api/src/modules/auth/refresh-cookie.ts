import type { ClientType } from '@musicverse/types';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../config/env';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.types';

function cookieName(clientType: ClientType): string | null {
  return clientType === 'mobile' ? null : REFRESH_COOKIE[clientType];
}

function options(config: AppConfig, maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export function setRefreshCookie(res: Response, config: AppConfig, clientType: ClientType, token: string): void {
  const name = cookieName(clientType);
  if (name) res.cookie(name, token, options(config, config.auth.refreshTtlDays * 86_400_000));
}

export function clearRefreshCookie(res: Response, config: AppConfig, clientType: ClientType): void {
  const name = cookieName(clientType);
  if (name) res.clearCookie(name, options(config));
}

export function readRefreshCookie(req: Request, clientType: ClientType): string | undefined {
  const name = cookieName(clientType);
  const value = name ? (req.cookies as Record<string, unknown> | undefined)?.[name] : undefined;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
