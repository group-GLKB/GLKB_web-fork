/**
 * Opening a conversation must not erase the turn it is still being asked.
 *
 * A follow-up released into the background writes its [question, ""] pair to the store before
 * the server has saved anything. The detail fetch upserted the server's shorter copy over it,
 * so the next visit showed neither the question the reader had already sent nor its spinner —
 * and, with the local copy no longer looking ahead, the visit-time reconcile then took the
 * run's registry mark down while it was still writing, which released everything else queued
 * for that conversation onto the run already in flight.
 */
import { fetchConversationDetail, getConversations, setConversations } from './chatHistory';

let mockRunning = new Set();

jest.mock('../service/ChatHistory', () => ({
    listChatHistories: jest.fn(),
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));
jest.mock('../service/activeRun', () => ({
    isConversationRunning: (id) => mockRunning.has(String(id)),
    reconcileRunsWithServer: jest.fn(),
}));

const { getChatHistoryDetail } = require('../service/ChatHistory');

const message = (role, content) => ({ role, content, references: [], created_at: null });

const serverDetail = (messages) => ({
    hid: 7,
    public_id: 'pub-7',
    leading_title: 'A conversation',
    last_accessed_time: '2026-09-16T12:00:00Z',
    created_at: '2026-09-16T11:00:00Z',
    messages,
});

const storedWith = (messages) => setConversations([{
    id: '7',
    title: 'A conversation',
    updatedAt: '2026-09-16T12:00:00Z',
    createdAt: '2026-09-16T11:00:00Z',
    messageCount: messages.length,
    messages,
}]);

beforeEach(() => {
    sessionStorage.clear();
    mockRunning = new Set();
    getChatHistoryDetail.mockReset();
});

it('keeps the follow-up being answered in the background', async () => {
    mockRunning.add('7');
    storedWith([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'The follow-up' },
        { role: 'assistant', content: '' },        // still being written
    ]);
    getChatHistoryDetail.mockResolvedValueOnce(serverDetail([
        message('user', 'First question'),
        message('assistant', 'First answer'),
    ]));

    await fetchConversationDetail('7');

    const stored = getConversations().find((item) => item.id === '7');
    expect(stored.messages).toHaveLength(4);
    expect(stored.messages[2].content).toBe('The follow-up');
});

it('still hands the caller the server copy, which a new turn must build on', async () => {
    mockRunning.add('7');
    storedWith([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: '' },
    ]);
    getChatHistoryDetail.mockResolvedValueOnce(serverDetail([
        message('user', 'First question'),
        message('assistant', 'The answer the server saved'),
    ]));

    const detail = await fetchConversationDetail('7');

    // A background turn asks for this to escape a stored copy frozen mid-exchange.
    expect(detail.messages.map((m) => m.content))
        .toEqual(['First question', 'The answer the server saved']);
});

it('takes the server copy when nothing is running here', async () => {
    storedWith([
        { role: 'user', content: 'Stale local question' },
        { role: 'assistant', content: '' },
    ]);
    getChatHistoryDetail.mockResolvedValueOnce(serverDetail([
        message('user', 'First question'),
        message('assistant', 'First answer'),
    ]));

    await fetchConversationDetail('7');

    const stored = getConversations().find((item) => item.id === '7');
    expect(stored.messages.map((m) => m.content)).toEqual(['First question', 'First answer']);
});

it('takes the server copy when the local one is finished', async () => {
    mockRunning.add('7');
    storedWith([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'A local answer' },
    ]);
    getChatHistoryDetail.mockResolvedValueOnce(serverDetail([
        message('user', 'First question'),
        message('assistant', 'The answer the server saved'),
    ]));

    await fetchConversationDetail('7');

    const stored = getConversations().find((item) => item.id === '7');
    expect(stored.messages[1].content).toBe('The answer the server saved');
});
