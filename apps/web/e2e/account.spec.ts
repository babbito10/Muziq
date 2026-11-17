import { expect, test } from '@playwright/test';
import { PASSWORD, register, uniqueEmail } from './support';

test.describe('Account settings', () => {
  test('updates profile and theme, lists the session and deletes the account', async ({ page }) => {
    const email = uniqueEmail('settings');
    await register(page, { email, displayName: 'Sam Settings' });
    await page.goto('/account');

    await page.getByLabel('Display name').fill('Sam Sound');
    await page.getByLabel('Username').fill('sam.sound' + Date.now().toString().slice(-6));
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    await page.getByText('Light', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await expect(page.getByText('This device')).toBeVisible();

    await page.getByRole('button', { name: 'Delete my account…' }).click();
    await page.getByLabel('Password', { exact: true }).last().fill(PASSWORD);
    await page.getByLabel('Type "DELETE" to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Permanently delete' }).click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' })).toBeVisible();
  });
});
