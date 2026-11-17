'use client';

import { Badge, Button, cn, LoadingRegion, Logo, Skeleton } from '@musicverse/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAdminAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/', label: 'Users', permission: 'admin:users.read' as const },
  { href: '/audit-logs', label: 'Audit log', permission: 'admin:audit.read' as const },
];

/** Signed-in frame for every admin page; redirects to /login when there is no staff session. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { status, user, can, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <LoadingRegion label="Loading admin console">
        <div className="p-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </LoadingRegion>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-border bg-bg-elevated px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Admin home">
            <Logo withWordmark={false} />
            <span className="font-semibold">Admin</span>
          </Link>
          <nav aria-label="Admin">
            <ul className="flex gap-1">
              {NAV.filter((n) => can(n.permission)).map((n) => {
                const active =
                  n.href === '/'
                    ? pathname === '/' || pathname.startsWith('/users')
                    : pathname.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm',
                        active ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:text-fg',
                      )}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-fg-muted">{user.email}</span>
          {user.roles
            .filter((r) => ['moderator', 'admin', 'super_admin'].includes(r))
            .map((r) => (
              <Badge key={r} tone="accent">
                {r}
              </Badge>
            ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl p-6">
        {children}
      </main>
    </div>
  );
}
