'use client';

import type { AuditLogEntry, Paginated } from '@musicverse/types';
import { Alert, Button, EmptyState, LoadingRegion, Skeleton, TextField } from '@musicverse/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

export function AuditLogTable() {
  const [action, setAction] = useState('');
  const [applied, setApplied] = useState('');
  const [pages, setPages] = useState<Paginated<AuditLogEntry>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.auditLogs({ limit: 50, cursor, action: applied || undefined });
        setPages((prev) => (cursor ? [...prev, page] : [page]));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [applied],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const entries = pages.flatMap((p) => p.data);
  const nextCursor = pages.at(-1)?.page.nextCursor ?? null;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(action.trim()); }}>
        <TextField label="Action prefix" placeholder="e.g. auth.login or admin." value={action} onChange={(e) => setAction(e.target.value)} className="min-w-64" />
        <Button type="submit" variant="secondary" className="h-11">Filter</Button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && entries.length === 0 ? (
        <LoadingRegion label="Loading audit log"><Skeleton className="h-64" /></LoadingRegion>
      ) : entries.length === 0 && !error ? (
        <EmptyState title="No audit entries" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="bg-surface text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                <th scope="col" className="px-4 py-3 font-medium">Target</th>
                <th scope="col" className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-3">{e.actorEmail ?? (e.actorId ? e.actorId.slice(0, 8) : 'anonymous')}</td>
                  <td className="px-4 py-3">
                    {e.targetType === 'user' && e.targetId ? (
                      <Link href={`/users/${e.targetId}`} className="text-primary hover:underline">user {e.targetId.slice(0, 8)}</Link>
                    ) : e.targetType ? `${e.targetType} ${e.targetId?.slice(0, 8) ?? ''}` : '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-fg-subtle" title={JSON.stringify(e.metadata)}>
                    {e.metadata ? JSON.stringify(e.metadata) : ''} {e.ipAddress ? `· ${e.ipAddress}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && <div><Button variant="secondary" loading={loading} onClick={() => load(nextCursor)}>Load more</Button></div>}
    </div>
  );
}
