'use client';

import { ROLE_DEFINITIONS } from '@musicverse/auth';
import { Badge, buttonClasses, Card, LoadingRegion, Skeleton } from '@musicverse/ui';
import Link from 'next/link';
import { EmailVerificationBanner } from '@/components/account/EmailVerificationBanner';
import { useAuth } from '@/lib/auth-context';

/** Honest roadmap: what is live today and what is coming, by phase. */
const ROADMAP = [
  { phase: 1, title: 'Accounts & security', body: 'One account for every role, two-step verification, session control.', live: true },
  { phase: 2, title: 'Listen & release', body: 'Artist profiles, rights-checked uploads, streaming, playlists and search.', live: false },
  { phase: 3, title: 'Discover & connect', body: 'Recommendations, follows, posts, communities and notifications.', live: false },
  { phase: 4, title: 'Create with AI', body: 'Creator Studio, licensed AI music tools and a marketing assistant.', live: false },
  { phase: 5, title: 'Earn', body: 'Subscriptions, tips, a beat and services marketplace, and payouts.', live: false },
  { phase: 6, title: 'Grow', body: 'DJ workspace, music learning, events and radio.', live: false },
];

function Roadmap() {
  return (
    <section aria-labelledby="roadmap-heading" className="mt-10">
      <h2 id="roadmap-heading" className="font-display text-xl font-semibold">Building MusicVerse</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ROADMAP.map((item) => (
          <li key={item.phase}>
            <Card className="h-full p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Phase {item.phase}</span>
                {item.live ? <Badge tone="success">Live</Badge> : <Badge>Coming</Badge>}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{item.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeView() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <LoadingRegion>
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      </LoadingRegion>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 sm:px-12 sm:py-20">
          <div aria-hidden="true" className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gradient opacity-30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              One world. Every sound.{' '}
              <span className="bg-brand-gradient bg-clip-text text-transparent">Endless possibilities.</span>
            </h1>
            <p className="mt-5 text-lg text-fg-muted">
              Listen, create, release and connect — whether you&apos;re a fan, an artist, a producer, a DJ or a music
              business. One account for all of it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={buttonClasses('primary', 'lg')}>Create your free account</Link>
              <Link href="/login" className={buttonClasses('secondary', 'lg')}>Sign in</Link>
            </div>
          </div>
        </section>
        <Roadmap />
      </div>
    );
  }

  const capabilities = user.roles.filter((r) => r !== 'listener');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <EmailVerificationBanner />
      <section className="rounded-3xl border border-border bg-surface p-8">
        <p className="text-sm font-medium text-primary">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl font-bold">{user.profile.displayName}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Listener</Badge>
          {capabilities.map((role) => (
            <Badge key={role} tone="accent">{ROLE_DEFINITIONS[role].name}</Badge>
          ))}
          <Link href="/account#capabilities" className="text-sm font-medium text-primary hover:underline">
            {capabilities.length ? 'Manage capabilities' : 'Become an artist, producer or DJ'}
          </Link>
        </div>
      </section>
      <Roadmap />
    </div>
  );
}
