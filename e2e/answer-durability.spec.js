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
 * Signed out on purpose. A guest has no conversation row, so nothing about the recovery can
 * lean on stored history — which is exactly the path that broke, and the path every visitor
 * to the home page takes. `storageState` is cleared per test for that reason.
 */
import { test, expect } from '@playwright/test';

const QUESTION = 'What is BRCA1 and what is its role in DNA repair?';
// Long enough that the run is unambiguously mid-flight: the agent spends this long on tool
// calls before the first answer token, so the interruption lands during the work, not after.
const MID_RUN_MS = 9000;
const SETTLE_TIMEOUT_MS = 150000;

test.use({ storageState: { cookies: [], origins: [] } });

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

        // The question comes back from the run snapshot, and the answer is polled for by
        // session id — a guest has no history row to read it out of.
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
