/**
 * A queued follow-up stays in its own conversation — on screen, in the queue bubble, and in
 * the answer that eventually lands.
 *
 * The scenario is the reader who queues a follow-up mid-answer, starts a new chat, queues
 * another follow-up there, and then moves between the two conversations while everything is
 * still being written. Every part of that used to smear: the released follow-up went through
 * the foreground submit path and took the singleton view state with it, so one conversation's
 * spinner, progress and answer appeared in whichever conversation was open; switching released
 * nothing, so a reattach repointed the running refs under a live stream and its frames wrote
 * into the wrong transcript; and the registry mark of the conversation being OPENED was
 * cleared by a flush/reattach race, which let the queue release a second turn onto a history
 * id that was still answering.
 *
 * Needs an account (TEST_TOKEN), because the sidebar and conversation switching are the
 * subject. Spends real agent turns (~$0.16 for the four), so it is not part of the unit
 * suite:
 *   TEST_TOKEN=... BASE_URL=http://localhost:3111 npx playwright test e2e/queue-routing.spec.js
 */
import { test, expect } from '@playwright/test';

const NONCE = Math.random().toString(36).slice(2, 6).toUpperCase();
const Q1 = `(${NONCE}-A1) What genes are most strongly associated with pancreatic cancer?`;
const Q2 = `(${NONCE}-A2) Which of those genes are actionable drug targets?`;
const Q3 = `(${NONCE}-B1) What is the role of TP53 in breast cancer?`;
const Q4 = `(${NONCE}-B2) How does TP53 loss affect treatment response?`;
/* Leak detection goes by nonce, not by topic. Both questions are about cancer genes, and a
   correct answer to one legitimately names the other's genes — the first version of this
   spec grepped for /TP53/ in conversation A and failed on A's own, correct answer, which
   listed TP53 among the top pancreatic-cancer genes. Only the nonce tokens are unambiguous:
   they exist nowhere but in this run's own questions. */
const A_WORDS = [new RegExp(`${NONCE}-A`)];
const B_WORDS = [new RegExp(`${NONCE}-B`)];
const SETTLE_TIMEOUT_MS = 240000;

const view = (page) => page.evaluate(() => ({
    users: Array.from(document.querySelectorAll('.message-card[data-message-role="user"]'))
        .map((node) => node.innerText.trim()),
    answers: Array.from(document.querySelectorAll(
        '.message-card[data-message-role="assistant"] .markdown-body',
    )).map((node) => node.innerText.trim()),
    queued: Array.from(document.querySelectorAll('.queued-prompt-text'))
        .map((node) => node.innerText.trim()),
}));

const expectOnlyOwnContent = (v, foreignWords, label) => {
    const all = [...v.users, ...v.answers, ...v.queued].join(' | ');
    for (const word of foreignWords) {
        expect(all, `${label}: another conversation's content leaked in`).not.toMatch(word);
    }
};

const ask = async (page, text) => {
    const box = page.locator('textarea:not([aria-hidden="true"])').first();
    await box.click();
    await box.fill(text);
    await page.keyboard.press('Enter');
};

const openRow = async (page, needle) => {
    const rows = page.locator('button.recent-entry-button');
    const texts = await rows.allInnerTexts();
    const index = texts.findIndex((t) => t.includes(needle));
    expect(index, `sidebar row containing ${needle}`).toBeGreaterThanOrEqual(0);
    await rows.nth(index).click();
};

/** Wait until the conversation on screen shows `count` non-empty answers. */
const settledAnswers = async (page, count) => {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let v = null;
    while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        v = await view(page);
        const done = v.answers.length >= count
            && v.answers.every((a) => a.length > 10)
            && v.queued.length === 0;
        if (done) return v;
    }
    return v;
};

test('queued follow-ups in two conversations land in their own threads', async ({ page }) => {
    test.setTimeout(600000);
    await page.goto('/');
    const signedIn = await page.evaluate(() => Boolean(localStorage.getItem('access_token')));
    test.skip(!signedIn, 'needs TEST_TOKEN — the sidebar is the subject');

    // Conversation A: ask, then queue a follow-up mid-answer.
    await ask(page, Q1);
    await page.waitForTimeout(6000);
    await ask(page, Q2);
    await page.waitForTimeout(1500);
    let v = await view(page);
    expect(v.queued.join(' ')).toContain('actionable');
    expectOnlyOwnContent(v, B_WORDS, 'A mid-run');

    // Conversation B: new chat, ask, queue another follow-up.
    await page.getByRole('link', { name: /new chat/i }).first().click();
    await page.waitForTimeout(2500);
    await ask(page, Q3);
    await page.waitForTimeout(6000);
    await ask(page, Q4);
    await page.waitForTimeout(1500);
    v = await view(page);
    expect(v.queued.join(' ')).toContain('treatment response');
    expectOnlyOwnContent(v, A_WORDS, 'B mid-run');

    // Move between them while both are still writing; nothing may cross over.
    await openRow(page, `${NONCE}-A1`);
    for (let i = 0; i < 10; i += 1) {
        await page.waitForTimeout(2500);
        expectOnlyOwnContent(await view(page), B_WORDS, `viewing A, t+${(i + 1) * 2.5}s`);
    }
    await openRow(page, `${NONCE}-B1`);
    for (let i = 0; i < 4; i += 1) {
        await page.waitForTimeout(2500);
        expectOnlyOwnContent(await view(page), A_WORDS, `viewing B, t+${(i + 1) * 2.5}s`);
    }

    // Both conversations end whole: two questions, two real answers, empty queue.
    await openRow(page, `${NONCE}-A1`);
    const finalA = await settledAnswers(page, 2);
    expectOnlyOwnContent(finalA, B_WORDS, 'A final');
    expect(finalA.users).toHaveLength(2);
    expect(finalA.answers).toHaveLength(2);
    expect(finalA.queued).toHaveLength(0);

    await openRow(page, `${NONCE}-B1`);
    const finalB = await settledAnswers(page, 2);
    expectOnlyOwnContent(finalB, A_WORDS, 'B final');
    expect(finalB.users).toHaveLength(2);
    expect(finalB.answers).toHaveLength(2);
    expect(finalB.queued).toHaveLength(0);

    /* Leave no residue: the two conversations this run created are deleted through the same
       API the app uses. The account is shared with humans checking the product by hand, and
       a sidebar full of nonce-tagged questions is noise they should never see. Deliberately
       AFTER the assertions — a failing run keeps its data for investigation. */
    const apiBase = process.env.GLKB_API_BASE
        || 'https://jieliulab3.dcmb.med.umich.edu/reorg-api';
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    const listResponse = await page.request.get(
        `${apiBase}/api/v1/new-llm-agent/history?limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    const { histories = [] } = await listResponse.json();
    for (const row of histories) {
        if (String(row.leading_title || '').includes(NONCE)) {
            await page.request.delete(
                `${apiBase}/api/v1/new-llm-agent/history/${row.hid}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
        }
    }
});
