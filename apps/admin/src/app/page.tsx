'use client';

import { AdminShell } from '@/components/AdminShell';
import { UsersTable } from '@/components/UsersTable';

export default function UsersPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <UsersTable />
    </AdminShell>
  );
}
