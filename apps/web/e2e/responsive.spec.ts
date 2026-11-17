import { expect, test } from '@playwright/test';

test('mobile layout uses the bottom navigation and marks unreleased modules', async ({ page }) => {
  await page.goto('/');
  const bottomNav = page.getByRole('navigation', { name: 'Primary' }).last();
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(bottomNav.locator('[aria-disabled="true"]').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
