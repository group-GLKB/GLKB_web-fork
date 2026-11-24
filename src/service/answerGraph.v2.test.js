/**
 * Asking the backend for an answer graph (`fetchAnswerGraphV2`, service/answerGraph.js;
 * `POST /api/v1/new-llm-agent/answer-graph`). Every failure is the basic graph, and a backend
 * without the route (dev before its deploy) is asked once per page load, not once per answer.
 */
import axios from '../utils/axiosConfig';
import { clearAnswerGraphCache, fetchAnswerGraphV2 } from './answerGraph';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

const BASIC = { graph: null, basic: true };
const GRAPH = { version: 1, nodes: [], edges: [], chain: [] };
const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

beforeEach(() => {
    axios.post.mockReset();
    clearAnswerGraphCache();
});

it('asks by the answer\'s row when it has one, else by its invocation id', async () => {
    axios.post.mockResolvedValue({ data: { answer_graph: GRAPH } });
    await expect(fetchAnswerGraphV2({ historyId: '42', messageId: 88, invocationId: 'inv-1' }))
        .resolves.toEqual({ graph: GRAPH, basic: false });
    expect(axios.post).toHaveBeenLastCalledWith('/api/v1/new-llm-agent/answer-graph',
        { history_id: 42, message_id: 88 }, expect.objectContaining({ timeout: expect.any(Number) }));
    await fetchAnswerGraphV2({ historyId: 42, invocationId: 'inv-2' });
    expect(axios.post.mock.calls[1][1]).toEqual({ history_id: 42, invocation_id: 'inv-2' });
});

it('asks once per answer per page load', async () => {
    axios.post.mockResolvedValue({ data: { answer_graph: GRAPH } });
    await fetchAnswerGraphV2({ historyId: 42, messageId: 88 });
    await fetchAnswerGraphV2({ historyId: 42, messageId: 88 });
    expect(axios.post).toHaveBeenCalledTimes(1);
});

it('reads basic and null as the basic graph', async () => {
    axios.post.mockResolvedValueOnce({ data: { answer_graph: null, basic: true } });
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 1 })).resolves.toEqual(BASIC);
    axios.post.mockResolvedValueOnce({ data: { answer_graph: null } });
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 2 })).resolves.toEqual(BASIC);
});

it('asks nothing without a saved conversation and an address', async () => {
    await expect(fetchAnswerGraphV2({ historyId: null, messageId: 1 })).resolves.toEqual(BASIC);
    await expect(fetchAnswerGraphV2({ historyId: 42 })).resolves.toEqual(BASIC);
    await expect(fetchAnswerGraphV2({ historyId: 'local-1', invocationId: 'x' })).resolves.toEqual(BASIC);
    expect(axios.post).not.toHaveBeenCalled();
});

it('falls back on a refusal or a failure, and asks again the next time', async () => {
    axios.post.mockRejectedValueOnce(httpError(502, { detail: { code: 'ANSWER_GRAPH_UNAVAILABLE' } }));
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 5 })).resolves.toEqual(BASIC);
    axios.post.mockRejectedValueOnce(httpError(429, { detail: { code: 'ANSWER_GRAPH_RATE_LIMITED' } }));
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 5 })).resolves.toEqual(BASIC);
    // Not the owner / no such answer: the backend names it, so the route exists.
    axios.post.mockRejectedValueOnce(httpError(404, { detail: 'Answer not found in this chat history' }));
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 5 })).resolves.toEqual(BASIC);
    axios.post.mockResolvedValueOnce({ data: { answer_graph: GRAPH } });
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 5 })).resolves.toEqual({ graph: GRAPH, basic: false });
    expect(axios.post).toHaveBeenCalledTimes(4);
});

it('stops asking a backend that does not have the route', async () => {
    axios.post.mockRejectedValueOnce(httpError(404, { detail: 'Not Found' }));
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 5 })).resolves.toEqual(BASIC);
    await expect(fetchAnswerGraphV2({ historyId: 42, messageId: 6 })).resolves.toEqual(BASIC);
    await expect(fetchAnswerGraphV2({ historyId: 43, invocationId: 'inv-9' })).resolves.toEqual(BASIC);
    expect(axios.post).toHaveBeenCalledTimes(1);
});
