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
