import type { ReactNode } from 'react';
import { cn } from '../cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, string> = {
  info: 'border-primary/40 bg-primary/10',
  success: 'border-success/40 bg-success/10',
  warning: 'border-warning/40 bg-warning/10',
  danger: 'border-danger/40 bg-danger/10',
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Errors and warnings are announced immediately (role=alert); others politely (role=status). */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
    >
      <div className="text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-fg-muted')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
