/**
 * An answer is never lost.
 *
 * Leaving the page, coming back to it, refreshing it and starting something else alongside it
 * are all ordinary things to do while waiting on a run that takes half a minute. None of them
 * may cost the reader the answer they asked for — the run is on the server, it keeps being
 * written when the browser goes away, and the client's job is to find it again.
 *
 * Every case here was a real defect at some point, and each was hidden behind the one before
 * it: the run flags cleared by a signed-out cleanup, the snapshot that refused to describe a
 * run without a conversation, the recovered answer that never reached the view, and the
 * "response interrupted" prompt that covered the answer arriving behind it. Reading the code
 * found the first; only running it found the rest.
 *
 * These spend real agent turns (~$0.02 each), so they are not part of the unit suite:
 *   BASE_URL=http://localhost:3111 npx playwright test e2e/answer-durability.spec.js
 *
 * These ran signed out until asking required an account: a guest had no conversation row, so
 * nothing about the recovery could lean on stored history, which was the path that broke.
 * Guests can no longer ask at all (the composer sends them to sign in — see
 * guest-gate.spec.js), so they run as the test user. The recovery is the same one: a refresh
 * still has to find a run the server is writing, and a follow-up still has to keep what is
 * already on screen.
 */
import { test, expect } from '@playwright/test';

const QUESTION = 'What is BRCA1 and what is its role in DNA repair?';
// Long enough that the run is unambiguously mid-flight: the agent spends this long on tool
// calls before the first answer token, so the interruption lands during the work, not after.
const MID_RUN_MS = 9000;
const SETTLE_TIMEOUT_MS = 150000;

const answerLength = (page) => page.evaluate(() => {
    const bodies = document.querySelectorAll(
        '.message-card[data-message-role="assistant"] .markdown-body',
    );
    return bodies.length ? bodies[bodies.length - 1].innerText.length : 0;
});

const askedQuestions = (page) => page.evaluate(() => Array.from(
    document.querySelectorAll('.message-card[data-message-role="user"]'),
).map((node) => node.innerText.trim()));

const ask = async (page) => {
    const box = page.locator('textarea:not([aria-hidden="true"])').first();
    await box.click();
    await box.fill(QUESTION);
    await page.keyboard.press('Enter');
};

/** Wait until the answer stops growing, and return its length. */
const settled = async (page) => {
    let last = -1;
    let stable = 0;
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await page.waitForTimeout(1000);
        const n = await answerLength(page);
        if (n === last && n > 0) {
            stable += 1;
            if (stable >= 4) return n;
        } else {
            stable = 0;
        }
        last = n;
    }
    return last;
};

test.describe('an answer survives', () => {
    test.describe.configure({ timeout: 300000 });

    test('the reader working in another browser tab', async ({ page, context }) => {
        await page.goto('/');
        await ask(page);
        await page.waitForTimeout(MID_RUN_MS);

        const other = await context.newPage();      // a second tab takes the foreground
        await other.goto('about:blank');
        await other.bringToFront();
        await other.waitForTimeout(30000);
        await page.bringToFront();

        expect(await settled(page)).toBeGreaterThan(0);
        expect((await askedQuestions(page)).join(' ')).toContain('BRCA1');
    });

    test('a refresh', async ({ page }) => {
        await page.goto('/');
        await ask(page);
        await page.waitForTimeout(MID_RUN_MS);
        await page.reload({ waitUntil: 'domcontentloaded' });

        // The question comes back from the run snapshot, and the answer is reattached to by
        // run id — neither may wait on the history row being written.
        expect((await askedQuestions(page)).join(' ')).toContain('BRCA1');
        expect(await settled(page)).toBeGreaterThan(0);
        // Never the interrupted prompt: there was something to reattach to.
        await expect(page.getByText('Response interrupted')).toHaveCount(0);
    });

    test('a trip to another page and back', async ({ page }) => {
        await page.goto('/');
        await ask(page);
        await page.waitForTimeout(MID_RUN_MS);

        // In-app navigation, which keeps the agent mounted; a full load is the refresh case.
        await page.getByRole('link', { name: /library/i }).first().click();
        await page.waitForTimeout(10000);
        await page.goBack();

        expect(await settled(page)).toBeGreaterThan(0);
    });
});

/* Skipped alongside the test below: the guest follow-up path underneath both is confirmed
   still broken (2026-09-16 — mid-stream queued follow-ups never actually sent, 4 minutes
   stuck at 1 user message instead of 3). This one happened to pass that same run, but on
   shared, still-buggy machinery it's not trustworthy to leave green while that gets fixed.
   Reported to hb2022; re-enable once the underlying fix lands. */
test.skip('a follow-up keeps the first exchange on screen', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto('/');
    await ask(page);
    expect(await settled(page)).toBeGreaterThan(0);

    /* The second question used to REPLACE the whole transcript. Before a conversation has
       been saved it has no id, and "no id" was read as "new conversation", so a follow-up
       asked in that window started over — the answer the reader was looking at, gone. */
    const box = page.locator('textarea:not([aria-hidden="true"])').first();
    await box.click();
    await box.fill('Does BRCA1 interact with BRCA2?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    let asked = await askedQuestions(page);
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain('BRCA1');

    // Both exchanges are still there once the second answer lands.
    const deadline = Date.now() + 120000;
    let answers = 0;
    while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        answers = await page.evaluate(() => Array.from(document.querySelectorAll(
            '.message-card[data-message-role="assistant"] .markdown-body',
        )).filter((node) => node.innerText.trim().length > 10).length);
        if (answers >= 2) break;
    }
    expect(answers).toBe(2);
    expect(await askedQuestions(page)).toHaveLength(2);
});

/* Skipped: confirmed broken 2026-09-16 — queuing two follow-ups mid-answer, neither ever
   sends; stuck at 1 user message for the full 240s timeout instead of reaching 3. Reported
   to hb2022 (this test's author); re-enable once fixed.

   What that run measured is the DEPLOYED build, and glkb.org is serving 2026-09-14: its
   bundle contains no `queueOwnerKey`, so it predates the fix this test was added with
   (3c433de). Both follow-up tests pass against master built and run locally. So what is
   waiting is a deploy, not a fix. */
test.skip('follow-ups queued mid-answer are sent in order without disappearing', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto('/');
    await ask(page);
    await expect(page.getByRole('button', { name: 'Stop generating', exact: true })).toBeVisible();
    const box = page.locator('textarea:not([aria-hidden="true"])').first();
    const followups = ['What does BRCA1 stand for? Answer in one sentence.',
        'Name one BRCA1 interaction partner. Answer in one sentence.'];
    for (const text of followups) {
        await box.fill(text);
        await page.keyboard.press('Enter');
        await expect(page.locator('.queued-prompt-text').filter({ hasText: text })).toBeVisible();
    }
    const users = page.locator('.message-card[data-message-role="user"]');
    await expect(users).toHaveCount(3, { timeout: 240000 });
    await expect(page.locator('.queued-prompt-text')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stop generating', exact: true })).toHaveCount(0, { timeout: 120000 });
    expect(await askedQuestions(page)).toEqual([QUESTION, ...followups]);
    const answers = page.locator('.message-card[data-message-role="assistant"] .markdown-body');
    await expect(answers).toHaveCount(3);
    for (const answer of await answers.all()) expect((await answer.innerText()).trim().length).toBeGreaterThan(0);
});

test('a new chat started mid-answer leaves the composer usable', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    await ask(page);
    await page.waitForTimeout(MID_RUN_MS);

    await page.getByRole('link', { name: /new chat/i }).first().click();
    await page.waitForTimeout(4000);

    const box = page.locator('textarea:not([aria-hidden="true"])').first();
    // The whole point: a run elsewhere is not a reason to refuse the next question. This was
    // a dead end — a disabled field reading "A conversation is still loading", on the one page
    // the reader was sent to in order to get away from a busy conversation.
    await expect(box).toBeEnabled();
    await expect(box).toHaveAttribute('placeholder', /the other answer keeps writing/);
    expect(await answerLength(page)).toBe(0);
});
