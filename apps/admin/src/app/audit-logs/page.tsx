'use client';

import { AdminShell } from '@/components/AdminShell';
import { AuditLogTable } from '@/components/AuditLogTable';

export default function AuditLogsPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Audit log</h1>
      <AuditLogTable />
    </AdminShell>
  );
}
