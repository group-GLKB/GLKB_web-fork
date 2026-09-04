import { test, expect } from '@playwright/test';

test('Library page loads successfully', async ({ page }) => {
  await page.goto('/library');

  await expect(page).toHaveURL(/.*library/);
  await expect(page.locator('.library-page')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.library-folder-manager')).toBeVisible({ timeout: 10000 });
});

/* Same auto-collapse edge case as ai-chat.spec.js: the reference panel needs split-container
   width above ~1048px or it collapses, and the default Desktop Chrome viewport sits right at
   that edge once the nav sidebar takes its share. */
test.use({ viewport: { width: 1600, height: 900 } });

test('Library: bookmarked chat and reference surface there, and group into a folder', async ({ page }) => {
  test.setTimeout(120000);

  // Open an existing conversation from History rather than asking a new question — free, and
  // it already has a settled reference panel to bookmark from.
  await page.goto('/history');
  await expect(page.locator('.history-page')).toBeVisible({ timeout: 5000 });
  const firstCard = page.locator('.history-item').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });
  const chatTitle = (await firstCard.locator('.history-title').innerText()).trim();
  await firstCard.click();
  await page.waitForURL('**/chat');

  // Bookmark the chat from the header.
  const chatHeader = page.locator('.llm-header');
  if (await chatHeader.getByTitle('Remove bookmark').count() === 0) {
    await chatHeader.getByTitle('Bookmark this chat').click();
  }
  await expect(chatHeader.getByTitle('Remove bookmark')).toBeVisible({ timeout: 5000 });

  /* Bookmark its first reference. Matched into Library by PMID, not by the title shown here —
     the chat page's reference panel can carry a placeholder title ("PMID 41597354") for a
     reference the backend's own favorite-lookup already has the real title for, a mismatch
     between two backend data sources worth reporting separately but not this test's problem
     to work around by anything other than using the identifier that's consistent everywhere. */
  const firstReferenceWrapper = page.locator('.references-list .reference-entry-wrapper').first();
  await expect(firstReferenceWrapper).toBeVisible({ timeout: 15000 });
  const pmid = await firstReferenceWrapper.getAttribute('data-pubmed-id');
  await firstReferenceWrapper.locator('.reference-card-actions .reference-card-icon-btn').first().click();

  // Both should now show up in Library.
  await page.goto('/library');
  await expect(page.locator('.library-page')).toBeVisible({ timeout: 5000 });

  await page.getByRole('tab', { name: 'Chat' }).click();
  const libraryChatRow = page.locator('.history-item-row').filter({ hasText: chatTitle });
  await expect(libraryChatRow).toBeVisible({ timeout: 10000 });

  await page.getByRole('tab', { name: 'Reference' }).click();
  const libraryRefRow = page.locator('.history-item-row').filter({ hasText: `PMID: ${pmid}` });
  await expect(libraryRefRow).toBeVisible({ timeout: 10000 });

  // Create a new folder.
  const folderName = `test-folder-${Date.now()}`;
  await page.getByRole('button', { name: 'Add folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await page.getByLabel('Folder name').fill(folderName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  const folderNavItem = page.locator('.library-folder-manager-item').filter({ hasText: folderName });
  await expect(folderNavItem).toBeVisible({ timeout: 10000 });

  // Add the reference to it — still on the References tab from the check above.
  await libraryRefRow.locator('.library-entry-more').click();
  await page.getByText('Add to folder').click();
  const manageDialog = page.getByRole('dialog').filter({ hasText: 'Manage folders' });
  await expect(manageDialog).toBeVisible({ timeout: 5000 });
  await manageDialog.getByText(folderName, { exact: true }).locator('xpath=..').locator('input[type="checkbox"]').click();
  await manageDialog.getByRole('button', { name: 'Save' }).click();
  await expect(manageDialog).not.toBeVisible({ timeout: 5000 });

  // Add the chat to it.
  await page.getByRole('tab', { name: 'Chat' }).click();
  await libraryChatRow.hover();
  await libraryChatRow.locator('.history-item-more').click();
  await page.getByText('Add to folder').click();
  await expect(manageDialog).toBeVisible({ timeout: 5000 });
  await manageDialog.getByText(folderName, { exact: true }).locator('xpath=..').locator('input[type="checkbox"]').click();
  await manageDialog.getByRole('button', { name: 'Save' }).click();
  await expect(manageDialog).not.toBeVisible({ timeout: 5000 });

  // Both should appear inside the folder.
  await folderNavItem.click();
  await expect(libraryChatRow).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: 'Reference' }).click();
  await expect(libraryRefRow).toBeVisible({ timeout: 10000 });

  /* Cleanup: un-bookmark both from "All Items" (the same UI action a user would take). The
     folder itself is left in place — there is no UI to delete it yet (create-only, reported
     separately); once that's added this test should delete it here too. A transient
     "list is refetching" state also satisfies not.toBeVisible() for a single poll, the same
     false pass api-keys.spec.js hit on delete — confirming again once the refetch has had
     time to settle catches a removal that didn't really land. */
  await page.locator('.library-folder-manager-item').filter({ hasText: 'All Items' }).click();
  await libraryRefRow.locator('.library-entry-more').click();
  await page.getByText('Remove bookmark').click();
  await expect(libraryRefRow).not.toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await expect(libraryRefRow).toHaveCount(0);

  await page.getByRole('tab', { name: 'Chat' }).click();
  await libraryChatRow.hover();
  await libraryChatRow.locator('.history-item-more').click();
  await page.getByText('Remove bookmark').click();
  await expect(libraryChatRow).not.toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await expect(libraryChatRow).toHaveCount(0);
});
