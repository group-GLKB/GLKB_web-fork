import { test, expect } from '@playwright/test';

test('API Keys: create, copy, done, then delete', async ({ page }) => {
  await page.goto('/api-page');

  // API Keys tab is the default — wait for the table to load
  await expect(page.locator('.api-keys-table')).toBeVisible({ timeout: 10000 });

  // Open the create dialog
  await page.locator('.api-keys-create').click();
  await expect(page.locator('.api-keys-dialog')).toBeVisible({ timeout: 5000 });

  // Enter a key name
  const keyName = `test-key-${Date.now()}`;
  await page.locator('#api-key-name').fill(keyName);

  // Submit
  await page.locator('.api-keys-dialog-button.is-primary').click();

  // "Save your key" screen — grab the key value, copy, then close
  await expect(page.locator('.api-keys-copy-button')).toBeVisible({ timeout: 10000 });
  const keyValue = await page.locator('.api-keys-created-key').innerText();
  await page.locator('.api-keys-copy-button').click();
  await page.locator('.api-keys-dialog-button.is-secondary').click();
  await expect(page.locator('.api-keys-dialog')).not.toBeVisible({ timeout: 5000 });

  // The new key should appear in the table
  const keyRow = page.locator('.api-keys-table-row').filter({ hasText: keyName });
  await expect(keyRow).toBeVisible({ timeout: 5000 });

  // Verify the key works by calling the API endpoint
  const response = await page.request.post('https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/api-key-agent/ask', {
    headers: { 'Content-Type': 'application/json' },
    data: {
      api_key: keyValue,
      question: 'What is BRCA1?',
      max_articles: 5,
    },
  });
  expect(response.ok()).toBeTruthy();

  // Click Delete on the new key's row
  await keyRow.locator('.api-keys-action.is-danger').click();

  // Confirm delete dialog appears
  await expect(page.locator('.api-keys-dialog')).toBeVisible({ timeout: 5000 });

  // Click the Delete confirm button
  await page.locator('.api-keys-dialog-button.is-primary.is-danger').click();

  // Dialog should close and the key should be gone from the table
  await expect(page.locator('.api-keys-dialog')).not.toBeVisible({ timeout: 5000 });
  await expect(keyRow).not.toBeVisible({ timeout: 5000 });
});
