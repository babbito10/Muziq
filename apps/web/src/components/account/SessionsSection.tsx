'use client';

import type { SessionSummary } from '@musicverse/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingRegion,
  Skeleton,
} from '@musicverse/ui';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const CLIENT_LABEL: Record<SessionSummary['clientType'], string> = {
  web: 'Web',
  mobile: 'Mobile app',
  admin: 'Admin console',
};

function describeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' on ') || ua.slice(0, 60);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function SessionsSection() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await api.auth.sessions());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Where you're signed in"
        description="Sign out of devices you don't recognise."
      />
      {error && (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {!sessions && !error && (
        <LoadingRegion label="Loading sessions">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </LoadingRegion>
      )}
      {sessions && sessions.length === 0 && <EmptyState title="No active sessions" />}
      {sessions && sessions.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-fg">
                  {describeAgent(s.userAgent)}
                  {s.current && <Badge tone="primary">This device</Badge>}
                </p>
                <p className="text-sm text-fg-subtle">
                  {CLIENT_LABEL[s.clientType]} · last active{' '}
                  {dateFormat.format(new Date(s.lastUsedAt))}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                </p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={revoking === s.id}
                  onClick={async () => {
                    setRevoking(s.id);
                    try {
                      await api.auth.revokeSession(s.id);
                      await load();
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setRevoking(null);
                    }
                  }}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
