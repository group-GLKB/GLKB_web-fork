/**
 * Stopping a run on the SERVER, not just in this tab.
 *
 * On BOTH pipelines the backend relay and the agent run are detached from the client socket on
 * purpose — that is what lets an answer survive a closed tab. The cost was that Stop only
 * stopped the reader's view: the run went on spending tokens producing an answer nobody would
 * read, and the conversation's exchange stayed unfinished, which is what the sidebar reads as
 * "still answering".
 *
 * Chat and deep research have separate routers, and the cancel must reach the one that owns
 * the relay task — cancelling the agent alone leaves the other service's task parked on a
 * stream that will never produce another frame. That routing is most of what is pinned here.
 */
import axios from '../utils/axiosConfig';
import { LLMAgentService } from './LLMAgent';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

const svc = () => new LLMAgentService();

beforeEach(() => { axios.post.mockReset(); });

describe('cancelRun', () => {
    it('posts to the chat router by default', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, was_running: true } });
        await svc().cancelRun('3f9c0a');

        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.post.mock.calls[0][0]).toBe('/api/v1/new-llm-agent/run/3f9c0a/cancel');
    });

    it('posts to the deep-research router for an investigate run', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, was_running: true } });
        await svc().cancelRun('3f9c0a', { investigate: true });

        expect(axios.post.mock.calls[0][0]).toBe('/api/v1/deep-research/run/3f9c0a/cancel');
    });

    it('returns what the server said, so a caller can tell a live stop from a no-op', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, status: 'cancelled', was_running: true } });
        const result = await svc().cancelRun('abc');
        expect(result).toEqual({ ok: true, status: 'cancelled', was_running: true });
    });

    it('escapes the run id rather than pasting it into the path', async () => {
        axios.post.mockResolvedValueOnce({ data: {} });
        await svc().cancelRun('a/b?c');
        expect(axios.post.mock.calls[0][0]).toBe('/api/v1/new-llm-agent/run/a%2Fb%3Fc/cancel');

        axios.post.mockResolvedValueOnce({ data: {} });
        await svc().cancelRun('a/b?c', { investigate: true });
        expect(axios.post.mock.calls[1][0]).toBe('/api/v1/deep-research/run/a%2Fb%3Fc/cancel');
    });

    it('does nothing without a run id', async () => {
        const result = await svc().cancelRun(null);
        expect(result).toBeNull();
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('lets a server failure reject, for the caller to swallow', async () => {
        // Stop must never be blocked by this request failing — the UI catches it and lets go of
        // the view regardless. What this pins is that the failure is not silently swallowed
        // *here*, where it would be invisible to the caller deciding what to do.
        axios.post.mockRejectedValueOnce(new Error('502'));
        await expect(svc().cancelRun('abc')).rejects.toThrow('502');
    });
});
