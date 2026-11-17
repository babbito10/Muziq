const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}
