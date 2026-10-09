import { test, expect } from '@playwright/test';
import { ImapFlow } from 'imapflow';

/**
 * Email-code login, end to end: open the sign-in overlay, request a code, read it out of
 * the test mailbox over IMAP, enter it, and land signed in — then sign back out through the
 * real menu so the account is exactly as this test found it.
 *
 * Needs a mailbox dedicated to this test account — every run reads the newest 6-digit code
 * that arrives in it after the request, so nothing else should be sending mail there:
 *   TEST_LOGIN_EMAIL              — the address this test logs in with, and the mailbox it reads
 *   TEST_LOGIN_EMAIL_APP_PASSWORD — an app password for that mailbox (IMAP)
 *   TEST_LOGIN_IMAP_HOST          — optional, defaults to imap.gmail.com (Gmail)
 *
 * The mailbox isn't provisioned yet (2026-09-18, waiting on backend) — this skips itself
 * until the two required env vars show up, rather than failing the hourly run over a
 * prerequisite nobody's finished setting up. Nothing else here should need to change once
 * they land; only the credentials were missing.
 */

const MAILBOX_READY = Boolean(
    process.env.TEST_LOGIN_EMAIL && process.env.TEST_LOGIN_EMAIL_APP_PASSWORD,
);

/** Poll the mailbox for the newest message with a 6-digit code that arrived after `since`. */
const fetchVerificationCode = async (since) => {
    const client = new ImapFlow({
        host: process.env.TEST_LOGIN_IMAP_HOST || 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.TEST_LOGIN_EMAIL,
            pass: process.env.TEST_LOGIN_EMAIL_APP_PASSWORD,
        },
        logger: false,
    });

    await client.connect();
    try {
        const lock = await client.getMailboxLock('INBOX');
        try {
            const deadline = Date.now() + 60000;
            while (Date.now() < deadline) {
                const uids = await client.search({ since });
                // Newest first — several codes could be sitting there from earlier retries.
                for (const uid of [...uids].reverse()) {
                    const { content } = await client.download(uid, undefined, { uid: true });
                    const chunks = [];
                    for await (const chunk of content) chunks.push(chunk);
                    const body = Buffer.concat(chunks).toString('utf8');
                    const match = body.match(/\b(\d{6})\b/);
                    if (match) return match[1];
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
            throw new Error('No verification code arrived in the mailbox within 60s');
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
};

test.use({ storageState: { cookies: [], origins: [] } });

test('email-code login signs a guest in, end to end', async ({ page }) => {
    test.skip(!MAILBOX_READY, 'waiting on the test mailbox — set TEST_LOGIN_EMAIL and TEST_LOGIN_EMAIL_APP_PASSWORD once backend provisions it');
    test.setTimeout(120000);

    const requestedAt = new Date();
    await page.goto('/chat');

    await page.getByRole('button', { name: 'Log in' }).click();
    const signInDialog = page.locator('.login-modal[role="dialog"]');
    await expect(signInDialog).toBeVisible();

    await signInDialog.locator('.login-input').fill(process.env.TEST_LOGIN_EMAIL);
    await signInDialog.locator('.continue-button').click();
    await page.waitForURL('**/verify-code');

    const code = await fetchVerificationCode(requestedAt);
    const digits = page.locator('.code-input');
    for (let i = 0; i < 6; i += 1) {
        await digits.nth(i).fill(code[i]);
    }
    await page.locator('.submit-button').click();

    // Signed in: back on the home page, with a real session in localStorage.
    await page.waitForURL('/chat');
    expect(await page.evaluate(() => Boolean(localStorage.getItem('access_token')))).toBeTruthy();

    // Sign back out through the real menu — leaves the account exactly as found, and
    // exercises the logout path in the same run rather than a separate test for it.
    await page.getByRole('button', { name: process.env.TEST_LOGIN_EMAIL }).click();
    await page.getByText('Log out', { exact: true }).click();
    await page.waitForURL('/chat');
    expect(await page.evaluate(() => Boolean(localStorage.getItem('access_token')))).toBeFalsy();
});
