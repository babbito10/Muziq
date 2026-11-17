'use client';

import { LoadingRegion, Skeleton } from '@musicverse/ui';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

/** Client-side gate for signed-in pages. The API enforces authorisation regardless. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return (
      <LoadingRegion label="Loading your account">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </LoadingRegion>
    );
  }
  return <>{children}</>;
}
