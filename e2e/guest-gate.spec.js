/**
 * A guest cannot ask a question, and is told what to do instead.
 *
 * The server refuses a signed-out question, so the composer's job is to say so BEFORE the
 * question is sent — otherwise the reader waits, then loses both the answer and the text
 * they typed. Every way of operating either composer opens the sign-in overlay.
 *
 * Nothing here reaches the agent, so these cost nothing to run:
 *   BASE_URL=http://localhost:3111 npx playwright test e2e/guest-gate.spec.js
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const signInDialog = (page) => page.locator('.login-modal[role="dialog"]');

/** Nothing a guest does may reach the endpoints that spend an agent turn. */
const watchForAsking = (page) => {
    const asked = [];
    page.on('request', (request) => {
        if (/\/(new-llm-agent|deep-research)\/stream/.test(request.url())) {
            asked.push(request.url());
        }
    });
    return asked;
};

const composer = (page) => page.locator('textarea:not([aria-hidden="true"])').first();

test('the home composer sends a guest to sign in, not to the agent', async ({ page }) => {
    const asked = watchForAsking(page);
    await page.goto('/');

    await composer(page).click();
    await expect(signInDialog(page)).toBeVisible();

    await page.getByRole('button', { name: 'Close sign in' }).click();
    await expect(signInDialog(page)).toHaveCount(0);

    // The send button is the other half of the same door.
    await page.getByRole('button', { name: 'Start chat' }).click();
    await expect(signInDialog(page)).toBeVisible();

    // Still on the home page: a guest is never handed a chat that cannot answer them.
    expect(new URL(page.url()).pathname).toBe('/');
    expect(asked).toEqual([]);
});

test('a guest cannot type a question into the home composer', async ({ page }) => {
    await page.goto('/');

    await composer(page).click();
    await page.getByRole('button', { name: 'Close sign in' }).click();
    await page.keyboard.type('What is BRCA1?');

    await expect(composer(page)).toHaveValue('');
});

test('a guest asked to open a chat lands back at the gated composer', async ({ page }) => {
    const asked = watchForAsking(page);
    // /chat with nothing open sends anyone home — a guest has no conversation to open, and
    // now no way to start one, so this is the whole of what they can reach.
    await page.goto('/chat');
    await page.waitForTimeout(3000);
    expect(new URL(page.url()).pathname).toBe('/');

    await composer(page).click();
    await expect(signInDialog(page)).toBeVisible();

    await page.getByRole('button', { name: 'Close sign in' }).click();
    await page.keyboard.type('What is BRCA1?');

    await expect(composer(page)).toHaveValue('');
    expect(asked).toEqual([]);
});
