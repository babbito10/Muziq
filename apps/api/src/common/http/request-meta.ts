import type { Request } from 'express';
import { isIP } from 'node:net';

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/**
 * Truncate an IP for storage: IPv4 → /24, IPv6 → /48. Keeps abuse analysis possible while
 * avoiding storing full addresses (data minimisation).
 */
export function truncateIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const version = isIP(clean);
  if (version === 4) {
    const parts = clean.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (version === 6) {
    const expanded = clean.split('::');
    const head = (expanded[0] ?? '').split(':').filter(Boolean);
    const tail = expanded.length > 1 ? (expanded[1] ?? '').split(':').filter(Boolean) : [];
    const groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
    return `${groups.slice(0, 3).join(':')}::/48`;
  }
  return null;
}

export function requestMeta(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  return {
    ipAddress: truncateIp(req.ip),
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
    requestId: typeof req.id === 'string' ? req.id : null,
  };
}
