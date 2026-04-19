import { test, expect } from '@playwright/test';

test.skip('Explore Graph renders nodes after search', async ({ page }) => {
  // Navigate directly to /search (accessible via Explore in NavBar)
  await page.goto('/search');

  // Wait for the search input to be visible
  const input = page.locator('.explore-pill-input input');
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill('BRCA1');

  // Wait for and select the first autocomplete suggestion
  const option = page.locator('.MuiAutocomplete-option').first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();

  // Click the search button
  await page.locator('.search-button-big').click();

  // Wait for graph canvas to render
  const canvas = page.locator('.graph-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30000 });
});
