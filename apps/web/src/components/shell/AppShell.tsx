'use client';

import { Avatar, Badge, Button, buttonClasses, cn, Logo, Skeleton } from '@musicverse/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PRIMARY_NAV, type NavItem } from '@/lib/navigation';
import { Icon } from './Icon';

function NavEntry({
  item,
  active,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const base = compact
    ? 'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium'
    : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium';

  if (!item.available) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} arrives in Phase ${item.phase}`}
        className={cn(base, 'cursor-not-allowed text-fg-subtle')}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {!compact && (
          <Badge className="ml-auto" aria-label={`${item.label} coming soon`}>
            Soon
          </Badge>
        )}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'transition-colors',
        active ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
        compact && active && 'bg-transparent text-primary',
      )}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function AccountControls() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  if (status === 'loading') return <Skeleton className="h-10 w-40" />;
  if (status === 'anonymous' || !user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={buttonClasses('ghost', 'sm')}>
          Sign in
        </Link>
        <Link href="/register" className={buttonClasses('primary', 'sm')}>
          Create account
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-surface-hover"
        aria-label={`Account settings for ${user.profile.displayName}`}
      >
        <Avatar name={user.profile.displayName} src={user.profile.avatarUrl} size="sm" />
        <span className="hidden text-sm font-medium sm:inline">{user.profile.displayName}</span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await logout();
          router.push('/');
        }}
      >
        <Icon name="logout" className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border bg-bg-elevated p-4 lg:flex">
        <Link href="/" className="px-2 pt-2" aria-label="MusicVerse home">
          <Logo />
        </Link>
        <nav aria-label="Primary">
          <ul className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <NavEntry item={item} active={isActive(item)} />
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
          <Link href="/" className="lg:hidden" aria-label="MusicVerse home">
            <Logo withWordmark={false} />
          </Link>
          <div className="ml-auto">
            <AccountControls />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg-elevated/95 backdrop-blur lg:hidden"
      >
        {PRIMARY_NAV.slice(0, 5).map((item) => (
          <NavEntry key={item.href} item={item} active={isActive(item)} compact />
        ))}
      </nav>
    </div>
  );
}
