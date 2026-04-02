import { test, expect } from '@playwright/test';

test('AI Chat returns a non-empty response', async ({ page }) => {
  await page.goto('/');

  // Type a question and submit (auth guard bypassed via storageState)
  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill('What is the role of BRCA1 in breast cancer?');
  await input.press('Enter');

  // Wait for navigation to /chat
  await page.waitForURL('**/chat');

  // Wait for AI response (streaming can take time)
  const response = page.locator('.markdown-body').first();
  await expect(response).toBeVisible({ timeout: 60000 });
  await expect(response).not.toBeEmpty();
});
