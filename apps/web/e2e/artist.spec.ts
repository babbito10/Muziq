import { expect, test } from '@playwright/test';
import { linkFromEmail, register, uniqueEmail } from './support';

test('Journey 2: an artist registers (account + verified email + artist capability)', async ({
  page,
}) => {
  const email = uniqueEmail('artist');
  await register(page, { email, displayName: 'Amani Artist' });

  await page.goto('/account');
  const addArtist = page.getByRole('button', { name: 'Add Artist capability' });
  await expect(addArtist).toBeDisabled();

  await page.goto(await linkFromEmail(email, '/verify-email'));
  await expect(page.getByText('Email verified')).toBeVisible();

  await page.goto('/account');
  await page.getByRole('button', { name: 'Add Artist capability' }).click();
  await expect(page.getByRole('button', { name: 'Remove Artist capability' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('Artist', { exact: true })).toBeVisible();
});
