/**
 * What a deploy is supposed to have made true.
 *
 * The hourly suite runs THIS repository's specs against whatever is deployed, and those two
 * things drift: a fix can sit on master for days while the running build predates it. Every
 * failure that costs the most time this week was that gap rather than a code defect —
 * a queue fix merged and not shipped, a backend that still answered signed-out callers after
 * the block was merged, a frontend paging a list against a server that cannot page.
 *
 * So these assert the CONTRACT, not the behaviour: cheap, deterministic, and each failure
 * names the half that is behind. Nothing here spends an agent turn — no question is ever
 * asked — so it is safe to run every hour.
 *
 *   TEST_TOKEN=... BASE_URL=https://dev.glkb.org npx playwright test e2e/deployment-health.spec.js
 */
import { test, expect } from '@playwright/test';

/** The API the deployed app actually talks to, learned from its own traffic. */
const apiOriginFrom = async (page) => {
    let origin = null;
    page.on('request', (request) => {
        const match = request.url().match(/^(https?:\/\/[^/]+(?:\/reorg-api)?)\/api\/v1\//);
        if (match && !origin) [, origin] = match;
    });
    await page.goto('/');
    await page.waitForTimeout(4000);
    expect(origin, 'the app made no API call to learn the origin from').not.toBeNull();
    return origin;
};

const token = (page) => page.evaluate(() => localStorage.getItem('access_token'));

test.describe('the deployed halves agree', () => {
    test('the conversation list can be paged', async ({ page }) => {
        const origin = await apiOriginFrom(page);
        const jwt = await token(page);
        test.skip(!jwt, 'needs TEST_TOKEN — the list is per account');

        const response = await page.request.get(
            `${origin}/api/v1/new-llm-agent/history?limit=2`,
            { headers: { Authorization: `Bearer ${jwt}` } },
        );
        expect(response.status()).toBe(200);
        const body = await response.json();

        expect(typeof body.total, 'the list says how many conversations exist').toBe('number');
        /* `next_cursor` is how a client asks for the page after this one. Without it the
           History page can only ever show the newest 20 — it refuses to page by offset,
           because the order key is last-accessed time and a bumped row would make it show one
           conversation twice and skip another. A failure here means the WEB app is deployed
           and the BACKEND is not. */
        expect(body.next_cursor, 'GET /history returned no next_cursor: the backend is behind')
            .toBeTruthy();
    });

    test('a signed-out caller cannot start a run', async ({ page }) => {
        const origin = await apiOriginFrom(page);

        /* Deliberately the clarify endpoint with an empty body: auth is resolved before the
           body is, so a deployment that closed guest mode answers 401 without touching the
           agent. On one that has NOT, the body is rejected instead — either way nothing runs
           and nothing is spent, which is what makes this safe to run hourly. */
        const response = await page.request.post(
            `${origin}/api/v1/deep-research/clarify`,
            { data: {}, failOnStatusCode: false },
        );

        expect(
            response.status(),
            'deep-research/clarify answered a signed-out caller with '
            + `${response.status()}: guest mode is still open on this backend`,
        ).toBe(401);
    });
});

test.describe('what the reader can reach', () => {
    test('every conversation in the list is reachable', async ({ page }) => {
        await page.goto('/history');
        await page.waitForTimeout(5000);
        const jwt = await token(page);
        test.skip(!jwt, 'needs TEST_TOKEN — History is per account');

        const read = () => page.evaluate(() => ({
            label: document.querySelector('.history-meta-text')?.innerText?.trim() || '',
            rows: document.querySelectorAll('.history-list .history-item-row').length,
            more: Boolean(document.querySelector('.history-load-more-button')),
        }));

        let view = await read();
        expect(view.label, 'the History page showed no count').not.toBe('');

        // Page to the end, the way a reader does.
        for (let i = 0; i < 25 && view.more; i += 1) {
            await page.locator('.history-load-more-button').click();
            await page.waitForTimeout(2000);
            const next = await read();
            expect(next.rows, 'a page was requested and nothing arrived').toBeGreaterThan(view.rows);
            view = next;
        }

        /* The label's own promise: while some conversations are still unloaded it reads
           "N of M", and once they are all here it is a plain total. A list that stops short
           of M with no way to ask for more is the reported bug. */
        const ofMatch = view.label.match(/^(\d+) of (\d+)/);
        expect(
            ofMatch,
            `stopped at "${view.label}" with no way to load the rest`,
        ).toBeNull();
        expect(view.label).toMatch(/^\d+ search history record/);
    });

    test('no internal retrieval ids reach the reader in a report', async ({ page }) => {
        const origin = await apiOriginFrom(page);
        const jwt = await token(page);
        test.skip(!jwt, 'needs TEST_TOKEN — History is per account');

        /* RECENT conversations only. A report written before a leak was fixed keeps its text
           forever — the fix changes what is written, not what is stored — so checking the
           whole archive would fail every hour over something no deploy can change. What this
           watches is what the RUNNING build produces. */
        const response = await page.request.get(
            `${origin}/api/v1/new-llm-agent/history?limit=20`,
            { headers: { Authorization: `Bearer ${jwt}` } },
        );
        expect(response.status()).toBe(200);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = ((await response.json()).histories || []).filter((h) => {
            const at = Date.parse(h.last_accessed_time);
            return Number.isFinite(at) && at >= cutoff;
        });
        test.skip(recent.length === 0, 'no conversation was written in the last day');

        /* `12345#0` is a note id — the internal address of one extracted passage. Useful to
           the writer, meaningless to the reader, and it has reached a report's judgment
           section before, where those citations stop being clickable. */
        const INTERNAL_ID = /\[[^\]\n]*\b\d{5,9}#\d+[^\]\n]*\]/;

        for (const history of recent.slice(0, 5)) {
            const detail = await page.request.get(
                `${origin}/api/v1/new-llm-agent/history/${history.hid}`,
                { headers: { Authorization: `Bearer ${jwt}` } },
            );
            if (detail.status() !== 200) continue;
            const answers = ((await detail.json()).messages || [])
                .filter((m) => m.role === 'assistant')
                .map((m) => m.content || '');
            for (const answer of answers) {
                const leak = answer.match(INTERNAL_ID);
                expect(
                    leak,
                    `"${history.leading_title}" shows an internal note id: ${leak?.[0]}`,
                ).toBeNull();
            }
        }
    });
});
