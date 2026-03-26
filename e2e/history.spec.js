import { test, expect } from '@playwright/test';

test('History page shows conversation after chat', async ({ page }) => {
  // First do a chat to create a history entry
  await page.goto('/');
  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill('What is BRCA1?');
  await input.press('Enter');
  await page.waitForURL('**/chat');

  // Wait for AI response to complete
  const response = page.locator('.markdown-body').first();
  await expect(response).toBeVisible({ timeout: 60000 });

  // Navigate to history
  await page.goto('/history');

  // Verify history page loaded and list has at least one entry
  await expect(page.locator('.history-page')).toBeVisible({ timeout: 5000 });
  const historyList = page.locator('.history-list');
  await expect(historyList).toBeVisible({ timeout: 10000 });
  await expect(historyList.locator('.history-card-meta').first()).toBeVisible();
});
