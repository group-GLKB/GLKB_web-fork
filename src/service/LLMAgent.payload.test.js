/**
 * What the chat request carries, per pipeline.
 *
 * The rule under test is easy to get wrong in a way nothing surfaces: Deep Research ignores
 * `filters` / `ranking_mode` (it runs its own hybrid retrieval), but the backend *persists*
 * `filters` onto the conversation. So sending them on an investigate turn does nothing now and
 * silently filters the NEXT ordinary chat turn in the same conversation.
 */
import axios from '../utils/axiosConfig';
import { LLMAgentService } from './LLMAgent';

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

    it('still goes to the deep-research endpoint and keeps its own fields', async () => {
        await run({ investigateEnabled: true, filters: ['review'], maxArticles: 40 });
        expect(sentUrl()).toContain('deep-research');
        expect(sentPayload().question).toBe('does X help?');
        expect(sentPayload().max_articles).toBe(40);
    });
});
