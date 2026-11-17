'use client';

import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { UserDetail } from '@/components/UserDetail';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminShell>
      <UserDetail id={id} />
    </AdminShell>
  );
}
