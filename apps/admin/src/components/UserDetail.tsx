'use client';

import { canManageRole, ROLE_DEFINITIONS } from '@musicverse/auth';
import type { AdminUserDetail } from '@musicverse/types';
import { ROLE_KEYS } from '@musicverse/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  LoadingRegion,
  Skeleton,
  TextField,
} from '@musicverse/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

export function UserDetail({ id }: { id: string }) {
  const { user: me, can } = useAdminAuth();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setUser(await api.admin.getUser(id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<AdminUserDetail>) {
    setError(null);
    setBusy(key);
    try {
      setUser(await action());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!user) {
    return error ? (
      <Alert tone="danger">{error}</Alert>
    ) : (
      <LoadingRegion>
        <Skeleton className="h-64" />
      </LoadingRegion>
    );
  }

  const isSelf = me?.id === user.id;
  const manageableRoles = ROLE_KEYS.filter((role) => role !== 'listener');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← All users
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{user.displayName || user.email}</h1>
        <p className="text-fg-muted">{user.email}</p>
      </header>
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader title="Overview" />
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          {[
            [
              'Status',
              <Badge key="s" tone={user.status === 'active' ? 'success' : 'danger'}>
                {user.status}
              </Badge>,
            ],
            ['Email', user.emailVerified ? 'Verified' : 'Not verified'],
            ['Two-step verification', user.mfaEnabled ? 'On' : 'Off'],
            ['Active sessions', String(user.activeSessions)],
            ['Joined', formatDate(user.createdAt)],
            ['Last sign-in', formatDate(user.lastLoginAt)],
            ['Linked providers', user.linkedProviders.join(', ') || 'None'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-fg-subtle">{label}</dt>
              <dd className="mt-1 text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Roles"
          description="Grants and revocations take effect immediately and are audit-logged."
        />
        <ul className="divide-y divide-border">
          {manageableRoles.map((role) => {
            const has = user.roles.includes(role);
            const decision = canManageRole({
              actorRoles: me?.roles ?? [],
              role,
              action: has ? 'revoke' : 'grant',
              isSelf,
            });
            return (
              <li key={role} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {ROLE_DEFINITIONS[role].name}
                    {ROLE_DEFINITIONS[role].isStaff && <Badge tone="accent">staff</Badge>}
                    {has && <Badge tone="primary">granted</Badge>}
                  </p>
                  <p className="text-sm text-fg-subtle">{ROLE_DEFINITIONS[role].description}</p>
                </div>
                {decision.allowed && (
                  <Button
                    size="sm"
                    variant={has ? 'secondary' : 'primary'}
                    loading={busy === role}
                    aria-label={`${has ? 'Revoke' : 'Grant'} ${ROLE_DEFINITIONS[role].name}`}
                    onClick={() =>
                      run(role, () =>
                        has
                          ? api.admin.revokeRole(user.id, role)
                          : api.admin.grantRole(user.id, { role }),
                      )
                    }
                  >
                    {has ? 'Revoke' : 'Grant'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {can('admin:users.manage') && !isSelf && user.status !== 'deleted' && (
        <Card className={user.status === 'suspended' ? '' : 'border-danger/40'}>
          {user.status === 'suspended' ? (
            <>
              <CardHeader
                title="Suspended"
                description="The user cannot sign in until reinstated."
              />
              <Button
                loading={busy === 'reinstate'}
                onClick={() => run('reinstate', () => api.admin.reinstate(user.id))}
              >
                Reinstate
              </Button>
            </>
          ) : (
            <>
              <CardHeader
                title="Suspend account"
                description="Signs the user out everywhere and blocks sign-in."
              />
              <div className="flex flex-wrap items-end gap-3">
                <TextField
                  label="Reason (recorded in the audit log)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-w-72 flex-1"
                />
                <Button
                  variant="danger"
                  disabled={reason.trim().length < 3}
                  loading={busy === 'suspend'}
                  onClick={() =>
                    run('suspend', () => api.admin.suspend(user.id, { reason: reason.trim() }))
                  }
                >
                  Suspend
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
