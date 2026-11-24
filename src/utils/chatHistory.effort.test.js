/**
 * A reloaded conversation keeps each exchange's effort level (`ChatMessageResponse.effort`, the
 * three-repo effort contract, 2026-11-05), so a conversation that mixed levels shows each answer's
 * own. Rows from before efforts carry none, and read their level off `investigateMode`.
 */
import { fetchConversationDetail } from './chatHistory';
import { messageEffort } from '../service/effortLevels';

jest.mock('../service/ChatHistory', () => ({
    listChatHistories: jest.fn(),
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));
jest.mock('../service/activeRun', () => ({
    isConversationRunning: () => false,
    reconcileRunsWithServer: jest.fn(),
}));

const { getChatHistoryDetail } = require('../service/ChatHistory');

beforeEach(() => {
    sessionStorage.clear();
    getChatHistoryDetail.mockReset();
});

const detail = (messages) => ({
    hid: 21,
    public_id: 'pub-21',
    leading_title: 'Mixed levels',
    last_accessed_time: '2026-11-05T12:00:00Z',
    created_at: '2026-11-05T11:00:00Z',
    messages,
});

it('keeps each exchange\'s own level, mixed in one conversation', async () => {
    getChatHistoryDetail.mockResolvedValueOnce(detail([
        { id: 1, role: 'user', content: 'Quick one', effort: 'low', invocation_id: 'inv-1' },
        { id: 2, role: 'assistant', content: 'Short answer', effort: 'low', invocation_id: 'inv-1' },
        { id: 3, role: 'user', content: 'Go deeper', effort: 'high', invocation_id: 'inv-2' },
        { id: 4, role: 'assistant', content: 'Long answer', effort: 'HIGH', invocation_id: 'inv-2' },
    ]));
    const { messages } = await fetchConversationDetail('21');
    expect(messages.map((m) => m.effort)).toEqual(['low', 'low', 'high', 'high']);
    expect(messages.map(messageEffort)).toEqual(['low', 'low', 'high', 'high']);
    // What the answer graph asks for it by.
    expect(messages[3]).toMatchObject({ id: 4, invocationId: 'inv-2' });
});

it('leaves the field off rows from before efforts, which read as Medium or Extra', async () => {
    getChatHistoryDetail.mockResolvedValueOnce(detail([
        { role: 'user', content: 'Old question', effort: null },
        { role: 'assistant', content: 'Old answer' },
        { role: 'user', content: 'Something odd', effort: 'turbo' },
        { role: 'assistant', content: 'Answer', effort: '' },
    ]));
    const { messages } = await fetchConversationDetail('21');
    messages.forEach((m) => expect(m).not.toHaveProperty('effort'));
    expect(messageEffort(messages[1])).toBe('medium');
    expect(messageEffort({ ...messages[1], investigateMode: true })).toBe('extra');
});
