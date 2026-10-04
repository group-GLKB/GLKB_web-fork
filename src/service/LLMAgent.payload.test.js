/**
 * What the chat request carries, per pipeline.
 *
 * The rule under test is easy to get wrong in a way nothing surfaces: Deep Research ignores
 * `filters` / `ranking_mode` (it runs its own hybrid retrieval), but the backend *persists*
 * `filters` onto the conversation. So sending them on an investigate turn does nothing now and
 * silently filters the NEXT ordinary chat turn in the same conversation.
 */
import axios from '../utils/axiosConfig';
import {
    extractFunnelMetrics,
    INVESTIGATE_MAX_REFERENCES,
    LLMAgentService,
    PHASE_PERCENT_FLOOR,
    refusalOf,
} from './LLMAgent';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

const sentPayload = () => axios.post.mock.calls[0][1];
const sentUrl = () => axios.post.mock.calls[0][0];

const run = async (options) => {
    axios.post.mockResolvedValueOnce({ data: '' });
    const svc = new LLMAgentService();
    await svc.chat('does X help?', new AbortController(), () => {}, options);
};

beforeEach(() => { axios.post.mockReset(); });

describe('ordinary chat', () => {
    it('sends the article-type filter', async () => {
        await run({ filters: ['review'], rankingMode: 'high_impact' });
        expect(sentPayload().filters).toEqual(['review']);
        expect(sentPayload().ranking_mode).toBe('high_impact');
    });

    it('sends an empty array so "no filter" can be expressed', async () => {
        // Omitting it would mean "no preference" and leave the stored filter in place, which is
        // what made turning "reviews only" back off a no-op (issue #11).
        await run({ filters: [] });
        expect(sentPayload().filters).toEqual([]);
    });

    it('omits ranking_mode when none was chosen', async () => {
        await run({ filters: ['review'], rankingMode: '' });
        expect(sentPayload()).not.toHaveProperty('ranking_mode');
    });
});

describe('service tier', () => {
    it('sends the chosen tier', async () => {
        await run({ serviceTier: 'premium' });
        expect(sentPayload().service_tier).toBe('premium');
    });

    it('sends it on the investigate path too — Investigate is priced by tier as well', async () => {
        await run({ serviceTier: 'premium', investigateEnabled: true });
        expect(sentPayload().service_tier).toBe('premium');
    });

    it('omits the field when none was chosen, so the backend default (Standard) applies', async () => {
        await run({ filters: [] });
        expect(sentPayload()).not.toHaveProperty('service_tier');
    });

    it('omits a blank tier rather than sending an empty string, and lower-cases one', async () => {
        await run({ serviceTier: '   ' });
        expect(sentPayload()).not.toHaveProperty('service_tier');
        axios.post.mockReset();
        await run({ serviceTier: ' Premium ' });
        expect(sentPayload().service_tier).toBe('premium');
    });

    it('never sends `model` or `effort`, which the backend answers with a 422', async () => {
        // Queue entries persisted before the credit system can still carry both.
        await run({ filters: [], model: 'gpt-6.1-sol', effort: 'quick', serviceTier: 'standard' });
        expect(sentPayload()).not.toHaveProperty('model');
        expect(sentPayload()).not.toHaveProperty('effort');
        axios.post.mockReset();
        await run({ model: 'gpt-6.1-sol', effort: 'quick', investigateEnabled: true });
        expect(sentPayload()).not.toHaveProperty('model');
        expect(sentPayload()).not.toHaveProperty('effort');
    });
});

describe('attachments', () => {
    it('sends the uploaded ids on an ordinary chat turn', async () => {
        await run({ filters: [], attachments: ['a1b2', ' c3d4 '] });
        expect(sentPayload().attachments).toEqual(['a1b2', 'c3d4']);
    });

    it('omits the field when there are none', async () => {
        await run({ filters: [], attachments: [] });
        expect(sentPayload()).not.toHaveProperty('attachments');
        axios.post.mockReset();
        await run({ filters: [] });
        expect(sentPayload()).not.toHaveProperty('attachments');
    });

    it('never sends them on Investigate, which does not read them', async () => {
        await run({ investigateEnabled: true, attachments: ['a1b2'] });
        expect(sentPayload()).not.toHaveProperty('attachments');
    });

    it('drops blanks and anything that is not an id', async () => {
        await run({ filters: [], attachments: ['', null, { id: 'x' }, 'ok'] });
        expect(sentPayload().attachments).toEqual(['ok']);
    });

    it('reads an attachment refusal like any other', () => {
        const error = {
            response: {
                status: 400,
                data: JSON.stringify({
                    detail: { code: 'ATTACHMENT_NOT_FOUND', message: 'One of the attached files is no longer available.' },
                }),
            },
        };
        expect(refusalOf(error)).toMatchObject({
            status: 400,
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'One of the attached files is no longer available.',
        });
    });
});

describe('a request refused before the stream opened', () => {
    // The stream is posted with responseType 'text', so the body arrives as a string.
    const httpError = (status, body) => Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, data: typeof body === 'string' ? body : JSON.stringify(body) },
    });

    it('reads the code and message out of a string body', () => {
        const refusal = refusalOf(httpError(429, { detail: {
            code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.', required: 45, remaining: 30,
            cheaper_option: { pipeline: 'deep_research', service_tier: 'standard', credits: 20 },
        } }));
        expect(refusal).toMatchObject({
            status: 429, code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.', remaining: 30,
        });
        expect(refusal.cheaper_option.service_tier).toBe('standard');
    });

    it('reads a guest refusal, and a plain-string detail', () => {
        expect(refusalOf(httpError(403, { detail: { code: 'GUEST_LOGIN_REQUIRED', message: 'Sign in.' } })))
            .toMatchObject({ status: 403, code: 'GUEST_LOGIN_REQUIRED' });
        expect(refusalOf(httpError(400, { detail: "Service tier 'advanced' is not enabled." })))
            .toMatchObject({ status: 400, code: null, message: "Service tier 'advanced' is not enabled." });
    });

    it('is null for anything that is not an HTTP refusal', () => {
        expect(refusalOf(new Error('Network Error'))).toBeNull();
        expect(refusalOf(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))).toBeNull();
    });

    it('reaches the caller as an error update carrying the refusal, then rethrows', async () => {
        axios.post.mockRejectedValueOnce(httpError(429, { detail: {
            code: 'GUEST_LIMIT_REACHED', pipeline: 'chat', limit: 100, used: 100, message: 'You have used your 100 free questions this month.',
        } }));
        const updates = [];
        const svc = new LLMAgentService();
        await expect(svc.chat('q', new AbortController(), (u) => updates.push(u), {})).rejects.toThrow();
        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatchObject({
            type: 'error',
            error: 'You have used your 100 free questions this month.',
            refusal: { code: 'GUEST_LIMIT_REACHED', limit: 100 },
        });
    });

    it('retries once after a second on CREDITS_BUSY, as the backend asks', async () => {
        axios.post
            .mockRejectedValueOnce(httpError(503, { detail: { code: 'CREDITS_BUSY' } }))
            .mockResolvedValueOnce({ data: '' });
        const updates = [];
        await new LLMAgentService().chat('q', new AbortController(), (u) => updates.push(u), {});
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(updates.filter((u) => u.type === 'error')).toHaveLength(0);
    }, 5000);

    it('does not retry any other refusal', async () => {
        axios.post.mockRejectedValueOnce(httpError(429, { detail: { code: 'INSUFFICIENT_CREDITS' } }));
        await expect(new LLMAgentService().chat('q', new AbortController(), () => {}, {})).rejects.toThrow();
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
});

describe('investigate (deep research)', () => {
    it('parses the Started frame instead of dropping it on a missing phase constant', async () => {
        const updates = [];
        axios.post.mockImplementationOnce(async (_url, _payload, config) => {
            config.onDownloadProgress({
                target: {
                    responseText: 'data: {"step":"Started","run_id":"run-1","session_id":"session-1"}\n\n',
                },
            });
            return { data: '' };
        });

        const svc = new LLMAgentService();
        await svc.chat(
            'does X help?',
            new AbortController(),
            (update) => updates.push(update),
            { investigateEnabled: true },
        );

        expect(updates).toContainEqual(expect.objectContaining({
            type: 'started',
            runId: 'run-1',
            sessionId: 'session-1',
            phase: 'searching',
            percent: PHASE_PERCENT_FLOOR.searching,
        }));
    });

    it('carries neither filters nor ranking_mode', async () => {
        await run({ investigateEnabled: true, filters: ['review'], rankingMode: 'high_impact' });
        expect(sentPayload()).not.toHaveProperty('filters');
        expect(sentPayload()).not.toHaveProperty('ranking_mode');
    });

    it('does not leak an empty filter list either', async () => {
        // `[]` is an explicit "clear it" to the backend — also not ours to send from a run that
        // never consulted the filter at all.
        await run({ investigateEnabled: true, filters: [] });
        expect(sentPayload()).not.toHaveProperty('filters');
    });

    it('asks for enough references instead of falling through to the backend default', async () => {
        // `max_articles` truncates the reference list the agent returns; nothing on this path sets
        // it (the Search Options control that used to was removed under Investigate), so the
        // request used to omit it and the backend's default of 20 capped every run at "20
        // Citations" no matter how many papers the answer cited.
        await run({ investigateEnabled: true });
        expect(sentPayload().max_articles).toBe(INVESTIGATE_MAX_REFERENCES);
        expect(INVESTIGATE_MAX_REFERENCES).toBeGreaterThan(20);
        expect(INVESTIGATE_MAX_REFERENCES).toBeLessThanOrEqual(100);   // the backend's `le`
    });

    it('an explicit maxArticles still wins over that default', async () => {
        await run({ investigateEnabled: true, maxArticles: 12 });
        expect(sentPayload().max_articles).toBe(12);
    });

    it('ordinary chat is left alone — no reference cap is invented for it', async () => {
        await run({ investigateEnabled: false });
        expect(sentPayload()).not.toHaveProperty('max_articles');
    });

    it('still goes to the deep-research endpoint and keeps its own fields', async () => {
        await run({ investigateEnabled: true, filters: ['review'], maxArticles: 40 });
        expect(sentUrl()).toContain('deep-research');
        expect(sentPayload().question).toBe('does X help?');
        expect(sentPayload().max_articles).toBe(40);
    });
});

// ── funnel field extraction ─────────────────────────────────────────────────────────────────
/**
 * The Cited counter reads `cited_provisional` off the agent frame, not `cited`.
 *
 * These also cover the alias fallback itself: `pick` used to bail out on the first key that was
 * absent, so every alias after the first was unreachable unless the first happened to be there.
 * That is why naming the right field was not enough on its own.
 */
describe('funnel metrics from an agent frame', () => {
    it('reads Cited from cited_provisional', () => {
        expect(extractFunnelMetrics({ cited_provisional: 17 }).cited).toBe(17);
    });

    it('prefers a plain cited when the agent sends both', () => {
        expect(extractFunnelMetrics({ cited: 9, cited_provisional: 17 }).cited).toBe(9);
    });

    it('finds cited_provisional nested under funnel and detail too', () => {
        expect(extractFunnelMetrics({ funnel: { cited_provisional: 4 } }).cited).toBe(4);
        expect(extractFunnelMetrics({ detail: { cited_provisional: 6 } }).cited).toBe(6);
    });

    it('falls through an absent alias instead of giving up on the field', () => {
        // `retrieved` missing, a later alias present — the whole point of the alias list.
        expect(extractFunnelMetrics({ n_retrieved: 4472 }).retrieved).toBe(4472);
        expect(extractFunnelMetrics({ n_screened: 53 }).screened).toBe(53);
        expect(extractFunnelMetrics({ extracted_papers: 20 }).extracted).toBe(20);
    });

    it('keeps an explicit zero rather than treating it as missing', () => {
        expect(extractFunnelMetrics({ cited_provisional: 0 }).cited).toBe(0);
    });

    it('leaves a counter null when no alias carries a number', () => {
        expect(extractFunnelMetrics({ retrieved: 12 }).cited).toBeNull();
    });

    it('returns null when the frame has no funnel fields at all', () => {
        expect(extractFunnelMetrics({ step: 'Processing', content: 'hello' })).toBeNull();
    });
});
