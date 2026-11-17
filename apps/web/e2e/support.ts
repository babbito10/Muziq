import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery staple';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.musicverse.test`;
}

export async function register(page: Page, opts: { email: string; displayName: string }): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(opts.displayName);
  await page.getByLabel('Email').fill(opts.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: opts.displayName })).toBeVisible();
}

/** Poll Mailpit for the newest message to `to` and return the first link matching `pathname`. */
export async function linkFromEmail(to: string, pathname: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await search.json()) as { messages: Array<{ ID: string }> };
    if (messages.length > 0) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`)).json()) as { Text: string };
      const match = new RegExp(`https?://[^\\s]+${pathname.replace('/', '\\/')}\\?token=[A-Za-z0-9_-]+`).exec(message.Text);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email with ${pathname} link for ${to}`);
}
