import { buttonClasses } from '@musicverse/ui/classes';
import { Logo } from '@musicverse/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="font-display text-3xl font-bold">This track skipped</h1>
      <p className="text-fg-muted">We couldn&apos;t find the page you were looking for.</p>
      <Link href="/" className={buttonClasses('primary')}>Back to home</Link>
    </main>
  );
}
