import { test, expect } from '@playwright/test';

test('AI Chat returns a non-empty response', { timeout: 120000 }, async ({ page }) => {
  await page.goto('/');

  // Type a question and submit (auth guard bypassed via storageState)
  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill('What molecular pathways link IL6 signaling to inflammatory responses?');
  await input.press('Enter');

  // Wait for navigation to /chat
  await page.waitForURL('**/chat');

  // Wait for AI response — the assistant's reply is the second .markdown-body
  const response = page.locator('.markdown-body').nth(1);
  await expect(response).toBeVisible({ timeout: 60000 });
  await expect(response).not.toBeEmpty();

  // Extract PubMed IDs from inline citation links in the AI response
  const citationLinks = response.locator('a[href*="pubmed.ncbi.nlm.nih.gov"]');
  await expect(citationLinks.first()).toBeVisible({ timeout: 30000 });
  const citationIds = await citationLinks.evaluateAll(els =>
    [...new Set(els.map(el => el.href.split('/').filter(Boolean).pop()))]
  );

  // Extract data-pubmed-id values from right-side reference list
  const referenceCards = page.locator('.references-list [data-pubmed-id]');
  const referencePubmedIds = await referenceCards.evaluateAll(els =>
    els.map(el => el.getAttribute('data-pubmed-id'))
  );

  // Every citation PubMed ID must appear in the right panel
  for (const id of citationIds) {
    expect(referencePubmedIds, `PubMed ID ${id} from response not found in reference panel`).toContain(id);
  }

  // Every reference card must have an "Original sentences" button
  const totalCards = await page.locator('.references-list .custom-div-url').count();
  const cardsWithEvidence = await page.locator('.references-list .custom-div-url button:has-text("Original sentences")').count();
  expect(cardsWithEvidence, `Only ${cardsWithEvidence}/${totalCards} reference cards have Original sentences`).toBe(totalCards);
});
