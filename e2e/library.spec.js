import { test, expect } from '@playwright/test';

test('Library page loads successfully', async ({ page }) => {
  await page.goto('/library');

  await expect(page).toHaveURL(/.*library/);
  await expect(page.locator('.library-page')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.library-folder-manager')).toBeVisible({ timeout: 10000 });
});
