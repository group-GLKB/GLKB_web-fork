import { test, expect } from '@playwright/test';

/**
 * Investigate mode is the same chat flow as ai-chat.spec.js underneath — same response,
 * same citation/reference checks would apply — with two differences: a run can take up to
 * ~15 minutes (see LLMAgent/index.jsx's reattach comment), and the agent may stop mid-run to
 * ask 1-4 clarifying questions before continuing. Whether that round appears at all is up to
 * the agent, not something this test controls, so it has to handle both "answer arrives
 * directly" and "a clarify round shows up first" without knowing in advance which happens.
 *
 * Kept separate from ai-chat.spec.js rather than folded in as another case there: a 15-minute
 * run every hour is a different cost/runtime profile than the rest of that file, and belongs
 * in its own file so it can be scheduled or skipped independently later if needed.
 */

const INVESTIGATE_TIMEOUT_MS = 20 * 60 * 1000;

test.use({ viewport: { width: 1600, height: 900 } });

test('Investigate mode reaches an answer, clicking through any clarifying questions', async ({ page }) => {
  test.setTimeout(INVESTIGATE_TIMEOUT_MS + 2 * 60 * 1000);

  await page.goto('/');

  // Investigate is off by default and fixed for the life of the session — turn it on before
  // the first question, not after.
  await page.getByTitle('Investigate off').click();
  await expect(page.getByTitle('Investigate on')).toBeVisible({ timeout: 5000 });

  const input = page.locator('.llm-searchbar textarea').first();
  await input.fill('Does p53 loss cause chemotherapy resistance across cancers, or does it not?');
  await input.press('Enter');
  // Each conversation now gets its own /chat/<id> URL, so a bare "**/chat" match never lands.
  await page.waitForURL(/\/chat(\/|$)/);

  /* Poll for whichever shows up next — a clarify round or the final answer — rather than
     checking once for a clarify round and then settling in to wait for the answer. There is
     no fixed window for when (or how many times) a round might appear, so a single early
     check can miss one that lands later: this test would then sit waiting on an answer that
     is never coming because a round is parked on screen wanting a click. Polling for either
     signal on every loop catches a round whenever it actually appears. */
  const clarifyPanel = page.locator('.clarify-panel');
  const response = page.locator('.markdown-body').nth(1);
  const deadline = Date.now() + INVESTIGATE_TIMEOUT_MS;
  let answered = false;

  while (Date.now() < deadline) {
    if (await clarifyPanel.isVisible().catch(() => false)) {
      // Pick the first option (or "Other" if a question offers none) so there is always
      // something to submit, then loop straight back around — another round can follow.
      const firstOption = clarifyPanel.locator('[role="radio"], [role="checkbox"]').first();
      if (await firstOption.count() > 0) {
        await firstOption.click();
      } else {
        await clarifyPanel.getByLabel(/^Use my own answer$/).click();
      }
      await clarifyPanel.locator('.clarify-submit').click();
      /* Give the submit a beat to actually land before re-checking, instead of re-entering
         this branch instantly. Without this the loop clicked a not-yet-updated panel over
         and over — a real 20-minute run never got past the first round because of it — since
         nothing here waited for the panel to close before deciding what to do next. */
      await clarifyPanel.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      continue;
    }
    if (await response.isVisible().catch(() => false)) {
      const text = await response.innerText();
      if (text.trim().length > 0) {
        answered = true;
        break;
      }
    }
    await page.waitForTimeout(2000);
  }
  expect(answered, 'investigate run produced neither an answer nor a clarify round within the time budget').toBeTruthy();

  // Same shape of check as ai-chat.spec.js from here — the response and its citations.
  const citationLinks = response.locator('a[href*="pubmed.ncbi.nlm.nih.gov"]');
  await expect(citationLinks.first()).toBeVisible({ timeout: 30000 });
});
