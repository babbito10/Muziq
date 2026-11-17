import { useId } from 'react';
import { cn } from '../cn';

/** MusicVerse wordmark with a sound-wave glyph. */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  // Unique per instance: a gradient defined inside a hidden (display:none) copy would not paint.
  const gradientId = `mv-logo-${useId().replace(/:/g, '')}`;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
        <g stroke="#0a0f1e" strokeWidth="2.4" strokeLinecap="round">
          <line x1="9" y1="13" x2="9" y2="19" />
          <line x1="13" y1="9" x2="13" y2="23" />
          <line x1="17" y1="11" x2="17" y2="21" />
          <line x1="21" y1="7" x2="21" y2="25" />
          <line x1="25" y1="13" x2="25" y2="19" />
        </g>
      </svg>
      {withWordmark ? (
        <span className="font-display text-lg font-bold tracking-tight text-fg">MusicVerse</span>
      ) : (
        <span className="sr-only">MusicVerse</span>
      )}
    </span>
  );
}
