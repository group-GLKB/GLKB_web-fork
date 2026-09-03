import { test, expect } from '@playwright/test';

/* The reference panel auto-collapses when the split container drops below ~1048px
   (LLMAgent/index.jsx: MIN_SPLIT_WIDTH_WITH_REFERENCES). The default Desktop Chrome
   viewport (1280x720) lands right at that edge once the nav sidebar takes its share,
   which made the reference-panel checks below flaky. A wider viewport keeps it open. */
test.use({ viewport: { width: 1600, height: 900 } });

test('AI Chat returns a non-empty response', { timeout: 150000 }, async ({ page }) => {
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

  // Extract data-pubmed-id values from right-side reference list — it fills in as the
  // response streams, lagging the inline citations by a beat.
  const referenceCards = page.locator('.references-list [data-pubmed-id]');
  await expect(referenceCards.first()).toBeVisible({ timeout: 60000 });
  const referencePubmedIds = await referenceCards.evaluateAll(els =>
    els.map(el => el.getAttribute('data-pubmed-id'))
  );

  // Every citation PubMed ID must appear in the right panel
  for (const id of citationIds) {
    expect(referencePubmedIds, `PubMed ID ${id} from response not found in reference panel`).toContain(id);
  }

  // Every reference card must carry at least one supporting excerpt
  const totalCards = await page.locator('.references-list .reference-card').count();
  const cardsWithEvidence = await page.locator('.references-list .reference-card-quote').count();
  expect(cardsWithEvidence, `Only ${cardsWithEvidence}/${totalCards} reference cards have a supporting excerpt`).toBe(totalCards);

  // Hovering an inline citation highlights its matching card in the reference panel
  const firstCitationId = citationIds[0];
  await citationLinks.first().hover();
  await expect(page.locator(`.references-list [data-pubmed-id="${firstCitationId}"]`))
    .toHaveClass(/highlighted/, { timeout: 5000 });

  // Per-message actions: copy, regenerate (present only — see cost note below), download, feedback
  // Reads the clipboard directly rather than racing the confirmation toast, which auto-dismisses
  // in a few seconds and can be gone before this assertion gets a chance to poll for it.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTitle('Copy response').click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText.length).toBeGreaterThan(0);

  // Not actually clicked: it would spend a second real LLM turn on every hourly run.
  await expect(page.getByTitle('Regenerate response')).toBeEnabled();

  const qaDownload = page.waitForEvent('download');
  await page.getByTitle('Download this Q&A').click();
  expect((await qaDownload).suggestedFilename()).toBeTruthy();

  await page.getByTitle('Share feedback').click();
  await expect(page.getByText('Share your feedback')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Cancel' }).click(); // no fake rating gets submitted

  // Bookmarking this chat toggles the header icon, then undoes it — leaves no residue
  const chatHeader = page.locator('.llm-header');
  const wasBookmarked = await chatHeader.getByTitle('Remove bookmark').count() > 0;
  await chatHeader.getByTitle(wasBookmarked ? 'Remove bookmark' : 'Bookmark this chat').click();
  await expect(chatHeader.getByTitle(wasBookmarked ? 'Bookmark this chat' : 'Remove bookmark')).toBeVisible({ timeout: 5000 });
  await chatHeader.getByTitle(wasBookmarked ? 'Bookmark this chat' : 'Remove bookmark').click();
  await expect(chatHeader.getByTitle(wasBookmarked ? 'Remove bookmark' : 'Bookmark this chat')).toBeVisible({ timeout: 5000 });

  // A reference card can be bookmarked and cited
  const firstCard = page.locator('.references-list .reference-card').first();
  const cardActions = firstCard.locator('.reference-card-actions .reference-card-icon-btn');
  await cardActions.nth(0).click(); // bookmark toggle
  await cardActions.nth(0).click(); // undo, same reason as the chat bookmark above
  await cardActions.nth(1).click(); // cite
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Escape');

  // Downloading all references produces a BibTeX file
  const exportDownload = page.waitForEvent('download');
  await page.getByTitle('Export all references').first().click();
  expect((await exportDownload).suggestedFilename()).toMatch(/\.bib$/);
});
