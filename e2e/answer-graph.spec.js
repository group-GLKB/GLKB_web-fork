import { test, expect } from '@playwright/test';

/* The reference panel and this card both want width; a narrow viewport pushes the card
   into its 'below'-legend layout, which still renders fine, but the wider desktop layout
   is what most readers actually see. */
test.use({ viewport: { width: 1600, height: 900 } });

/* The backend caches by exact query text — a fixed question every hour would quietly start
   serving a cached answer instead of exercising a real run. */
const withCacheBuster = (text) => `${text} (ignore the trailing digits: ${Math.floor(Math.random() * 1000000)})`;

// Since 2026-10-22, only Investigate answers have a graph. Its rendering is checked in
// investigate.spec.js using that test's existing research run, without another paid run.
test('an ordinary answer does not request or draw a knowledge graph', { timeout: 150000 }, async ({ page }) => {
  const graphRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/v1/search/answer-graph') graphRequests.push(request.url());
  });
  await page.goto('/chat');

  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill(withCacheBuster('How do BRCA1, BARD1, and RAD51 cooperate in homologous recombination DNA repair?'));
  await input.press('Enter');

  await page.waitForURL(/\/chat\//);

  const response = page.locator('.markdown-body').nth(1);
  await expect(response).toBeVisible({ timeout: 60000 });
  await expect(response).not.toBeEmpty();

  await expect(page.getByRole('button', { name: 'Copy response', exact: true })).toBeVisible({ timeout: 60000 });
  await response.scrollIntoViewIfNeeded();
  await expect(page.locator('.ag-card')).toHaveCount(0);
  expect(graphRequests).toEqual([]);
});
