'use client';

import type { AdminUserSummary, Paginated, RoleKey, UserStatus } from '@musicverse/types';
import { ROLE_KEYS } from '@musicverse/types';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  LoadingRegion,
  Skeleton,
  TextField,
} from '@musicverse/ui';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

const STATUS_TONE: Record<UserStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  active: 'success',
  suspended: 'danger',
  pending_deletion: 'warning',
  deleted: 'neutral',
};

interface Filters {
  q: string;
  status: UserStatus | '';
  role: RoleKey | '';
}

export function UsersTable() {
  const [filters, setFilters] = useState<Filters>({ q: '', status: '', role: '' });
  const [draftQuery, setDraftQuery] = useState('');
  const [pages, setPages] = useState<Paginated<AdminUserSummary>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.listUsers({
          limit: 25,
          cursor,
          q: filters.q || undefined,
          status: filters.status || undefined,
          role: filters.role || undefined,
        });
        setPages((prev) => (cursor ? [...prev, page] : [page]));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const users = pages.flatMap((p) => p.data);
  const nextCursor = pages.at(-1)?.page.nextCursor ?? null;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, q: draftQuery.trim() }));
        }}
      >
        <TextField
          label="Search"
          placeholder="Email, name or username"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          className="min-w-64 flex-1"
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Status
          <select
            className="h-11 rounded-xl border border-border bg-bg-elevated px-3"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as Filters['status'] }))
            }
          >
            <option value="">Any</option>
            {Object.keys(STATUS_TONE).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Role
          <select
            className="h-11 rounded-xl border border-border bg-bg-elevated px-3"
            value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as Filters['role'] }))}
          >
            <option value="">Any</option>
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" className="h-11">
          Search
        </Button>
      </form>

      {error && (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && users.length === 0 ? (
        <LoadingRegion label="Loading users">
          <Skeleton className="h-64 w-full" />
        </LoadingRegion>
      ) : users.length === 0 && !error ? (
        <EmptyState title="No users match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Users</caption>
            <thead className="bg-surface text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  User
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Roles
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Joined
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last sign-in
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${u.id}`}
                      className="font-medium text-fg hover:text-primary hover:underline"
                    >
                      {u.displayName || u.email}
                    </Link>
                    <div className="text-fg-subtle">
                      {u.email}
                      {!u.emailVerified && ' · unverified'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && (
        <div>
          <Button variant="secondary" loading={loading} onClick={() => load(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
