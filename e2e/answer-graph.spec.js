import { test, expect } from '@playwright/test';

/* The reference panel and this card both want width; a narrow viewport pushes the card
   into its 'below'-legend layout, which still renders fine, but the wider desktop layout
   is what most readers actually see. */
test.use({ viewport: { width: 1600, height: 900 } });

/* The backend caches by exact query text — a fixed question every hour would quietly start
   serving a cached answer instead of exercising a real run. */
const withCacheBuster = (text) => `${text} (ignore the trailing digits: ${Math.floor(Math.random() * 1000000)})`;

/**
 * The knowledge-graph card (AnswerGraph) draws underneath an answer once GLKB can connect
 * the entities it mentions. It is an annotation — the component itself swallows a failed
 * fetch and draws nothing rather than break the answer — so nothing else catches its
 * disappearance. This asks a question known to name several linked entities (same BRCA1 /
 * BARD1 / RAD51 / homologous-recombination neighborhood the card's own screenshots use) and
 * checks the card actually renders, with a legend and at least one drawn node.
 */
test('an answer draws its knowledge graph', { timeout: 150000 }, async ({ page }) => {
  await page.goto('/chat');

  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill(withCacheBuster('How do BRCA1, BARD1, and RAD51 cooperate in homologous recombination DNA repair?'));
  await input.press('Enter');

  await page.waitForURL(/\/chat\//);

  const response = page.locator('.markdown-body').nth(1);
  await expect(response).toBeVisible({ timeout: 60000 });
  await expect(response).not.toBeEmpty();

  // The card fetches its graph only once the answer is scrolled into view.
  const card = page.locator('.ag-card');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 60000 });

  // Cytoscape draws nodes onto a canvas; a real draw leaves at least one on screen.
  await expect(card.getByTestId('answer-graph-canvas').locator('canvas').first()).toBeVisible();

  // The legend and caption are plain DOM text, there whenever the card has real data.
  await expect(card.getByText('Entities', { exact: true })).toBeVisible();
  await expect(card.getByText('Relationships', { exact: true })).toBeVisible();
  await expect(page.getByText('Entities this answer is about', { exact: false })).toBeVisible();
});
