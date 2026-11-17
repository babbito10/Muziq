import { expect, test } from '@playwright/test';
import { linkFromEmail, PASSWORD, register, uniqueEmail } from './support';

test.describe('Journey 1: a listener registers', () => {
  test('registers, stays signed in across reloads, signs out and back in', async ({ page }) => {
    const email = uniqueEmail('listener');
    await register(page, { email, displayName: 'Lena Listener' });

    await expect(
      page.getByRole('alert').filter({ hasText: 'Verify your email address' }),
    ).toBeVisible();
    await expect(page.getByText('Listener', { exact: true })).toBeVisible();

    // Session survives a reload via the HttpOnly refresh cookie (the access token is memory-only).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Lena Listener' })).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify(localStorage) + document.cookie);
    expect(storage).not.toMatch(/eyJ/); // no JWTs in script-readable storage

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong password here');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }),
    ).toBeVisible();
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Lena Listener' })).toBeVisible();
  });

  test('verifies the email address from the real email', async ({ page }) => {
    const email = uniqueEmail('verify');
    await register(page, { email, displayName: 'Vera Verified' });
    const link = await linkFromEmail(email, '/verify-email');
    await page.goto(link);
    await expect(page.getByText('Email verified')).toBeVisible();
    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Vera Verified' })).toBeVisible();
    await expect(page.getByText('Verify your email address')).toHaveCount(0);
  });

  test('redirects anonymous visitors from account settings to sign in, then back', async ({
    page,
  }) => {
    const email = uniqueEmail('redirect');
    await register(page, { email, displayName: 'Rae Redirect' });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  });

  test('recovers a forgotten password via email', async ({ page }) => {
    const email = uniqueEmail('forgot');
    await register(page, { email, displayName: 'Fay Forgetful' });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();

    await page.goto(await linkFromEmail(email, '/reset-password'));
    await page.getByLabel('New password').fill('a completely new passphrase');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated')).toBeVisible();

    await page.getByRole('link', { name: 'Sign in with your new password' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('a completely new passphrase');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Fay Forgetful' })).toBeVisible();
  });
});
