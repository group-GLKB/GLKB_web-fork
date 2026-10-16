import { test, expect } from '@playwright/test';

/**
 * Email-code login, end to end: open the sign-in overlay, request a code, enter it, and
 * land signed in — then sign back out through the real menu so the account is exactly as
 * this test found it.
 *
 * `admin@glkb.org` is a dedicated monitoring account: the backend always accepts '111111'
 * for it instead of mailing out a real code, so this needs no mailbox to poll (the earlier
 * IMAP version of this test was waiting on that mailbox being provisioned — it never was;
 * this fixed-code account replaced the plan instead).
 */
const ADMIN_EMAIL = 'admin@glkb.org';
const ADMIN_CODE = '111111';

test.use({ storageState: { cookies: [], origins: [] } });

test('email-code login signs the monitoring admin in, end to end', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/chat');

    await page.getByRole('button', { name: 'Log in' }).click();
    const signInDialog = page.locator('.login-modal[role="dialog"]');
    await expect(signInDialog).toBeVisible();

    await signInDialog.locator('.login-input').fill(ADMIN_EMAIL);
    await signInDialog.locator('.continue-button').click();
    await page.waitForURL('**/verify-code');

    const digits = page.locator('.code-input');
    for (let i = 0; i < 6; i += 1) {
        await digits.nth(i).fill(ADMIN_CODE[i]);
    }
    await page.locator('.submit-button').click();

    // Signed in: back on the home page, with a real session in localStorage.
    await page.waitForURL('/chat');
    expect(await page.evaluate(() => Boolean(localStorage.getItem('access_token')))).toBeTruthy();

    // Sign back out through the real menu — leaves the account exactly as found, and
    // exercises the logout path in the same run rather than a separate test for it.
    await page.getByRole('button', { name: ADMIN_EMAIL }).click();
    await page.getByText('Log out', { exact: true }).click();
    await page.waitForURL('/chat');
    expect(await page.evaluate(() => Boolean(localStorage.getItem('access_token')))).toBeFalsy();
});
